import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createProviderOrder, getPaymentProvider, mapPaymentError, reportMissingPaymentCredentials } from "@/lib/payments";
import { datedReference, processSuccessfulPayment } from "@/lib/payments/order-service";
import { assertSameOrigin, rateLimit } from "@/lib/security/request";
import { USP_PRODUCT_SLUG, USP_SALE_PRICE } from "@/lib/constants";
import { getPublicAppUrl, getServerEnv, missingPaymentCredentialKeys } from "@/lib/env";
import { signAccessToken, verifyAccessToken } from "@/lib/security/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  assessmentId: z.string().uuid(),
  productSlug: z.enum(["credit-health-action-plan", "complete-loan-readiness-report"]),
  resultToken: z.string().min(20),
  referralCode: z.string().max(20).optional(),
});

async function persistProviderOrder(orderId: string, providerOrderId: string, provider: string, totalAmount: number) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId}::uuid FOR UPDATE`;
    const current = await tx.order.findUnique({ where: { id: orderId } });
    if (!current) throw new Error("Reserved payment order no longer exists.");
    if (current.providerOrderId && current.providerOrderId !== providerOrderId) {
      throw new Error("Reserved payment order is linked to a different provider order.");
    }
    await tx.order.update({
      where: { id: orderId },
      data: { providerOrderId, status: current.status === "PAID" ? "PAID" : "PENDING" },
    });
    const payment = await tx.payment.findFirst({ where: { orderId }, orderBy: { createdAt: "asc" } });
    if (payment) {
      await tx.payment.update({
        where: { id: payment.id },
        data: { provider, amount: totalAmount, currency: "INR" },
      });
    } else {
      await tx.payment.create({
        data: { orderId, provider, amount: totalAmount, currency: "INR", status: "CREATED" },
      });
    }
    if (current.status !== "PAID") {
      await tx.lead.update({ where: { id: current.leadId }, data: { stage: "PAYMENT_PENDING" } });
    }
  });
}

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

    // Cashfree payment-attempt failures do not necessarily close the provider
    // order. Reconcile every historical non-paid local order before allowing a
    // new chargeable session.
    const existingProviderOrders = await prisma.order.findMany({
      where: {
        assessmentId: assessment.id,
        productId: product.id,
        providerOrderId: { not: null },
        status: { in: ["CREATED", "PENDING", "FAILED", "CANCELLED"] },
        ...(env.PAYMENT_PROVIDER === "cashfree" ? {} : { createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } }),
      },
      orderBy: { createdAt: "desc" },
    });
    const existingPending = existingProviderOrders[0];

    if (env.PAYMENT_PROVIDER === "cashfree" && existingProviderOrders.length) {
      try {
        const { fetchCashfreeOrder } = await import("@/lib/payments/providers/cashfree");
        const { classifyCashfreeOrderStatus, isReusableCashfreeOrderStatus, isTerminalUnpaidCashfreeOrderStatus } = await import(
          "@/lib/payments/cashfree-browser"
        );
        const reusable: Array<{ order: (typeof existingProviderOrders)[number]; paymentSessionId: string }> = [];

        for (const providerOrder of existingProviderOrders) {
          const snapshot = await fetchCashfreeOrder(providerOrder.providerOrderId!, env);
          const status = String(snapshot.order_status || "").toUpperCase();
          const classification = classifyCashfreeOrderStatus(status);

          if (classification === "paid") {
            const verified = await getPaymentProvider("cashfree").verifyClientPayment(
              {
                internalOrderId: providerOrder.id,
                providerOrderId: providerOrder.providerOrderId!,
                expectedAmountPaise: Math.round(Number(providerOrder.totalAmount) * 100),
                raw: { order_id: providerOrder.providerOrderId! },
              },
              providerOrder.providerOrderId,
              env,
            );
            if (!verified.ok) {
              return NextResponse.json(
                { error: "Cashfree reports a paid order, but secure transaction verification is still pending. Do not pay again." },
                { status: 409 },
              );
            }
            const processed = await processSuccessfulPayment({
              orderId: providerOrder.id,
              providerPaymentId: verified.providerPaymentId,
              provider: "cashfree",
            });
            const reportToken = await signAccessToken(
              "report_access",
              processed.report.id,
              { leadId: providerOrder.leadId, orderId: providerOrder.id },
              "72h",
            );
            return NextResponse.json({
              internalOrderId: providerOrder.id,
              orderReference: providerOrder.orderReference,
              provider: "cashfree",
              providerOrderId: providerOrder.providerOrderId,
              amountPaise,
              currency: "INR",
              name: "VP Loan Connect",
              description: product.name,
              completed: true,
              reportId: processed.report.id,
              reportToken,
            });
          }

          if (snapshot.payment_session_id && isReusableCashfreeOrderStatus(status)) {
            reusable.push({ order: providerOrder, paymentSessionId: snapshot.payment_session_id });
          } else if (isTerminalUnpaidCashfreeOrderStatus(status)) {
            if (providerOrder.status !== "FAILED") {
              await prisma.order.update({ where: { id: providerOrder.id }, data: { status: "FAILED" } });
            }
          } else {
            return NextResponse.json(
              {
                error: "An existing Cashfree order could not be safely reconciled. Do not start another payment yet.",
                provider: "cashfree",
                orderReference: providerOrder.orderReference,
                internalOrderId: providerOrder.id,
                resumable: true,
              },
              { status: 503 },
            );
          }
        }

        if (reusable.length > 1) {
          return NextResponse.json(
            {
              error: "Multiple Cashfree orders are still active. Do not pay again until support reconciles the older orders.",
              provider: "cashfree",
              orderReference: reusable[0]!.order.orderReference,
              internalOrderId: reusable[0]!.order.id,
              resumable: true,
            },
            { status: 409 },
          );
        }

        const selected = reusable[0];
        if (selected) {
          const storedAmountPaise = Math.round(Number(selected.order.totalAmount) * 100);
          if (selected.order.currency !== "INR" || storedAmountPaise !== amountPaise) {
            return NextResponse.json(
              {
                error: "An active Cashfree order has an outdated amount. Do not pay until support closes that order.",
                provider: "cashfree",
                orderReference: selected.order.orderReference,
                internalOrderId: selected.order.id,
                resumable: true,
              },
              { status: 409 },
            );
          }
          if (selected.order.status !== "PENDING") {
            await prisma.order.update({ where: { id: selected.order.id }, data: { status: "PENDING" } });
          }
          return NextResponse.json({
            internalOrderId: selected.order.id,
            orderReference: selected.order.orderReference,
            provider: "cashfree",
            providerOrderId: selected.order.providerOrderId,
            amountPaise,
            currency: "INR",
            name: "VP Loan Connect",
            description: product.name,
            reused: true,
            checkout: {
              mode: "cashfree_checkout" as const,
              paymentSessionId: selected.paymentSessionId,
              env: env.CASHFREE_ENV === "production" ? ("production" as const) : ("sandbox" as const),
            },
          });
        }
      } catch {
        return NextResponse.json(
          {
            error: "Unable to reconcile the active Cashfree payment session. Do not start another payment yet.",
            provider: "cashfree",
            orderReference: existingPending?.orderReference,
            internalOrderId: existingPending?.id,
            resumable: true,
          },
          { status: 503 },
        );
      }
    } else if (existingPending && env.PAYMENT_PROVIDER !== "cashfree") {
      // Non-Cashfree: mark previous unfinished order failed before creating a fresh session.
      await prisma.order.update({ where: { id: existingPending.id }, data: { status: "FAILED" } });
    }

    // A transaction-scoped advisory lock makes concurrent tabs reserve the
    // same local Cashfree order. Provider creation then uses that order UUID as
    // both order_id and idempotency key.
    const order =
      env.PAYMENT_PROVIDER === "cashfree"
        ? await prisma.$transaction(async (tx) => {
            const lockKey = `checkout:${assessment.id}:${product.id}`;
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
            const reserved = await tx.order.findFirst({
              where: {
                assessmentId: assessment.id,
                productId: product.id,
                status: "CREATED",
                providerOrderId: null,
              },
              orderBy: { createdAt: "desc" },
            });
            if (reserved) return reserved;
            return tx.order.create({
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
          })
        : await prisma.order.create({
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

    if (
      env.PAYMENT_PROVIDER === "cashfree" &&
      (order.currency !== "INR" || Math.round(Number(order.totalAmount) * 100) !== amountPaise)
    ) {
      return NextResponse.json(
        {
          error: "A reserved Cashfree order has an outdated amount. Do not pay until support reconciles it.",
          provider: "cashfree",
          orderReference: order.orderReference,
          internalOrderId: order.id,
          resumable: true,
        },
        { status: 409 },
      );
    }

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
      await persistProviderOrder(order.id, provider.providerOrderId, provider.provider, totalAmount);
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
      if (env.PAYMENT_PROVIDER === "cashfree") {
        try {
          const { fetchCashfreeOrder } = await import("@/lib/payments/providers/cashfree");
          const snapshot = await fetchCashfreeOrder(order.id, env);
          if (snapshot.payment_session_id && snapshot.order_id === order.id) {
            await persistProviderOrder(order.id, snapshot.order_id, "cashfree", totalAmount);
            return NextResponse.json({
              internalOrderId: order.id,
              orderReference: order.orderReference,
              provider: "cashfree",
              providerOrderId: snapshot.order_id,
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
        } catch {
          // Ambiguous create: keep CREATED so the same deterministic provider
          // order/idempotency key is retried. Never open a second local order.
        }
      } else {
        await prisma.order.update({ where: { id: order.id }, data: { status: "FAILED" } });
      }
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
