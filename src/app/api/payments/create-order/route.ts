import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createProviderOrder } from "@/lib/payments/razorpay";
import { datedReference } from "@/lib/payments/order-service";
import { assertSameOrigin, rateLimit } from "@/lib/security/request";
import { USP_PRODUCT_SLUG, USP_SALE_PRICE } from "@/lib/constants";
import { getServerEnv } from "@/lib/env";
import { verifyAccessToken } from "@/lib/security/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  assessmentId: z.string().uuid(),
  productSlug: z.enum(["credit-health-action-plan", "complete-loan-readiness-report"]),
  resultToken: z.string().min(20),
  referralCode: z.string().max(20).optional(),
});

function publicPaymentError(message: string) {
  if (message === "INVALID_ORIGIN") {
    return {
      status: 403,
      error: "Please reload this page on www.vploanconnect.in and try again.",
    };
  }
  if (message.includes("Razorpay order credentials") || message.includes("Mock payments are disabled")) {
    return {
      status: 503,
      error: "Payment gateway is not configured on the server. Set PAYMENT_PROVIDER=razorpay and Razorpay keys on Vercel.",
    };
  }
  if (message.includes("Razorpay authentication failed") || message.includes("KEY_ID looks invalid")) {
    return {
      status: 502,
      error: "Razorpay keys are invalid or mismatched (test/live). Update RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on Vercel, then redeploy.",
    };
  }
  if (message.includes("Razorpay order creation failed")) {
    return {
      status: 502,
      error: message,
    };
  }
  if (message.includes("Invalid payment amount")) {
    return { status: 400, error: message };
  }
  return {
    status: 500,
    error: "Unable to open checkout right now. Please try again.",
  };
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
    const [assessment, product] = await Promise.all([
      prisma.assessment.findUnique({ where: { id: parsed.data.assessmentId } }),
      prisma.product.findUnique({ where: { slug: parsed.data.productSlug } }),
    ]);
    if (!assessment || assessment.leadId !== token.leadId || assessment.status !== "COMPLETED" || !product?.active) {
      return NextResponse.json({ error: "Assessment or product is unavailable." }, { status: 404 });
    }

    const subtotal = product.slug === USP_PRODUCT_SLUG ? USP_SALE_PRICE : Number(product.salePrice);
    const gstAmount = Math.round(subtotal * Number(product.gstRate)) / 100;
    const totalAmount = Math.round((subtotal + gstAmount) * 100) / 100;
    const amountPaise = Math.round(totalAmount * 100);

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
      });
      await prisma.$transaction([
        prisma.order.update({ where: { id: order.id }, data: { providerOrderId: provider.orderId, status: "PENDING" } }),
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
        providerOrderId: provider.orderId,
        keyId: provider.keyId,
        amountPaise,
        currency: "INR",
        name: "VP Loan Connect",
        description: product.name,
      });
    } catch (error) {
      await prisma.order.update({ where: { id: order.id }, data: { status: "FAILED" } });
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("create_order_failed", message);
    const mapped = publicPaymentError(message);
    let provider = "unknown";
    let keyConfigured = false;
    try {
      const env = getServerEnv();
      provider = env.PAYMENT_PROVIDER;
      keyConfigured = Boolean(env.RAZORPAY_KEY_ID?.trim() && env.RAZORPAY_KEY_SECRET?.trim());
    } catch {
      // ignore env read issues in error path
    }
    return NextResponse.json({ error: mapped.error, provider, keyConfigured }, { status: mapped.status });
  }
}
