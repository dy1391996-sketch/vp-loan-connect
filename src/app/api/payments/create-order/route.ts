import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createProviderOrder, mapPaymentError, reportMissingPaymentCredentials } from "@/lib/payments";
import { datedReference } from "@/lib/payments/order-service";
import { assertSameOrigin, rateLimit } from "@/lib/security/request";
import { USP_PRODUCT_SLUG, USP_SALE_PRICE } from "@/lib/constants";
import { getPublicAppUrl, getServerEnv, missingPaymentCredentialKeys } from "@/lib/env";
import { verifyAccessToken } from "@/lib/security/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  assessmentId: z.string().uuid(),
  productSlug: z.enum(["credit-health-action-plan", "complete-loan-readiness-report"]),
  resultToken: z.string().min(20),
  referralCode: z.string().max(20).optional(),
});

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });

    const token = await verifyAccessToken(parsed.data.resultToken, "result_access");
    if (token.sub !== parsed.data.assessmentId || typeof token.leadId !== "string") {
      return NextResponse.json({ error: "Secure assessment access is invalid. Go back and unlock again." }, { status: 403 });
    }
    if (!rateLimit(`checkout:${token.leadId}`, 10, 60 * 60 * 1000).allowed) {
      return NextResponse.json({ error: "Too many checkout attempts. Please wait a few minutes." }, { status: 429 });
    }

    const env = getServerEnv();
    const credentialReport = reportMissingPaymentCredentials(env);
    if (env.PAYMENT_PROVIDER !== "mock" && credentialReport.missing.length) {
      return NextResponse.json(
        {
          error: `Payment gateway (${credentialReport.displayName}) is not configured. Missing: ${credentialReport.missing.join(", ")}.`,
          provider: credentialReport.provider,
          missing: credentialReport.missing,
          keyConfigured: false,
        },
        { status: 503 },
      );
    }

    const [assessment, product, lead] = await Promise.all([
      prisma.assessment.findUnique({ where: { id: parsed.data.assessmentId } }),
      prisma.product.findUnique({ where: { slug: parsed.data.productSlug } }),
      prisma.lead.findUnique({ where: { id: token.leadId }, select: { fullName: true, mobile: true } }),
    ]);
    if (!assessment || assessment.leadId !== token.leadId || assessment.status !== "COMPLETED" || !product?.active) {
      return NextResponse.json({ error: "Assessment or product is unavailable." }, { status: 404 });
    }

    const emailAnswer = await prisma.assessmentAnswer.findFirst({
      where: { assessmentId: assessment.id, questionKey: "email" },
      select: { value: true },
    });
    const customerEmail = typeof emailAnswer?.value === "string" ? emailAnswer.value : undefined;

    // Expire stale unpaid checkouts for non-Cashfree providers so users cannot stack active orders.
    // Cashfree PENDING/ACTIVE must be confirmed via Cashfree before retiring — never force-fail ACTIVE locally.
    if (env.PAYMENT_PROVIDER !== "cashfree") {
      await prisma.order.updateMany({
        where: {
          assessmentId: assessment.id,
          productId: product.id,
          status: { in: ["CREATED", "PENDING"] },
          createdAt: { lt: new Date(Date.now() - 10 * 60 * 1000) },
        },
        data: { status: "FAILED" },
      });
    }

    const alreadyPaid = await prisma.order.findFirst({
      where: { assessmentId: assessment.id, productId: product.id, status: "PAID" },
      include: { reports: { select: { id: true }, take: 1 } },
    });
    if (alreadyPaid?.reports[0]) {
      return NextResponse.json({ error: "This booster is already unlocked for your assessment." }, { status: 409 });
    }

    const subtotal = product.slug === USP_PRODUCT_SLUG ? USP_SALE_PRICE : Number(product.salePrice);
    const gstAmount = Math.round(subtotal * Number(product.gstRate)) / 100;
    const totalAmount = Math.round((subtotal + gstAmount) * 100) / 100;
    const amountPaise = Math.round(totalAmount * 100);

    // Reuse unpaid Cashfree/local orders so Resume does not spawn duplicates.
    const existingPending = await prisma.order.findFirst({
      where: {
        assessmentId: assessment.id,
        productId: product.id,
        status: { in: ["CREATED", "PENDING"] },
        ...(env.PAYMENT_PROVIDER === "cashfree"
          ? { providerOrderId: { not: null } }
          : {
              createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
              providerOrderId: { not: null },
            }),
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingPending?.providerOrderId && env.PAYMENT_PROVIDER === "cashfree") {
      try {
        const { fetchCashfreeOrder } = await import("@/lib/payments/providers/cashfree");
        const { classifyCashfreeOrderStatus, isReusableCashfreeOrderStatus, isTerminalUnpaidCashfreeOrderStatus } = await import(
          "@/lib/payments/cashfree-browser"
        );
        const snapshot = await fetchCashfreeOrder(existingPending.providerOrderId, env);
        const status = String(snapshot.order_status || "").toUpperCase();
        const classification = classifyCashfreeOrderStatus(status);

        if (classification === "paid") {
          // Payment already captured at Cashfree — leave reuse path so the client can hit return/status unlock.
          return NextResponse.json({ error: "Payment already completed for this order. Refresh your result page." }, { status: 409 });
        }

        if (snapshot.payment_session_id && isReusableCashfreeOrderStatus(status)) {
          return NextResponse.json({
            internalOrderId: existingPending.id,
            orderReference: existingPending.orderReference,
            provider: "cashfree",
            providerOrderId: existingPending.providerOrderId,
            amountPaise,
            currency: "INR",
            name: "VP Loan Connect",
            description: product.name,
            reused: true,
            checkout: {
              mode: "cashfree_checkout" as const,
              paymentSessionId: snapshot.payment_session_id,
              env: env.CASHFREE_ENV === "production" ? ("production" as const) : ("sandbox" as const),
            },
          });
        }

        // Only retire on conclusive Cashfree terminal unpaid statuses.
        // Missing payment_session_id on an otherwise ACTIVE/PENDING order must NOT spawn a second chargeable order.
        if (isTerminalUnpaidCashfreeOrderStatus(status)) {
          await prisma.order.update({ where: { id: existingPending.id }, data: { status: "FAILED" } });
        } else {
          return NextResponse.json(
            {
              error:
                "Your Cashfree payment session is still active but could not be resumed yet. Tap Resume secure payment — do not start a new checkout.",
              provider: "cashfree",
              orderReference: existingPending.orderReference,
              internalOrderId: existingPending.id,
              resumable: true,
            },
            { status: 503 },
          );
        }
      } catch {
        // Never mark ACTIVE/PENDING as FAILED on a transient Cashfree API error — resume must reuse the same order.
        return NextResponse.json(
          {
            error: "Unable to resume the active Cashfree payment session. Tap Resume secure payment to try again.",
            provider: "cashfree",
            orderReference: existingPending.orderReference,
            internalOrderId: existingPending.id,
            resumable: true,
          },
          { status: 503 },
        );
      }
    } else if (existingPending && env.PAYMENT_PROVIDER !== "cashfree") {
      // Non-Cashfree: mark previous unfinished order failed before creating a fresh session.
      await prisma.order.update({ where: { id: existingPending.id }, data: { status: "FAILED" } });
    }

    const order = await prisma.order.create({
      data: {
        orderReference: datedReference("VPLC-ORD"),
        leadId: assessment.leadId,
        assessmentId: assessment.id,
        productId: product.id,
        subtotal,
        gstAmount,
        totalAmount,
        status: "CREATED",
        referralCode: parsed.data.referralCode || assessment.referralCode,
        source: assessment.source,
      },
    });

    try {
      const provider = await createProviderOrder({
        amountPaise,
        receipt: order.orderReference,
        notes: {
          internal_order_id: order.id,
          product: product.slug,
          referral: order.referralCode ?? "",
          provider_mode: env.PAYMENT_PROVIDER,
        },
        customer: {
          name: lead?.fullName,
          mobile: lead?.mobile,
          email: customerEmail,
        },
        returnUrl: `${getPublicAppUrl()}/api/payments/return?order_id={order_id}&internalOrderId=${order.id}`,
        notifyUrl: `${getPublicAppUrl()}/api/webhooks/payments/${env.PAYMENT_PROVIDER}`,
      });
      await prisma.$transaction([
        prisma.order.update({ where: { id: order.id }, data: { providerOrderId: provider.providerOrderId, status: "PENDING" } }),
        prisma.payment.create({
          data: {
            orderId: order.id,
            provider: provider.provider,
            amount: totalAmount,
            status: "CREATED",
          },
        }),
        prisma.lead.update({ where: { id: order.leadId }, data: { stage: "PAYMENT_PENDING" } }),
      ]);
      return NextResponse.json({
        internalOrderId: order.id,
        orderReference: order.orderReference,
        provider: provider.provider,
        providerOrderId: provider.providerOrderId,
        keyId: provider.keyId,
        amountPaise,
        currency: "INR",
        name: "VP Loan Connect",
        description: product.name,
        checkout: provider.checkout,
      });
    } catch (error) {
      await prisma.order.update({ where: { id: order.id }, data: { status: "FAILED" } });
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("create_order_failed", message);
    const mapped = mapPaymentError(error);
    let provider = "unknown";
    let keyConfigured = false;
    let missing: string[] = [];
    try {
      const env = getServerEnv();
      provider = env.PAYMENT_PROVIDER;
      missing = missingPaymentCredentialKeys(env);
      keyConfigured = missing.length === 0;
    } catch {
      // ignore env read issues in error path
    }
    return NextResponse.json({ error: mapped.error, provider, keyConfigured, missing: mapped.missing ?? missing }, { status: mapped.status });
  }
}
