import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPublicAppUrl, getServerEnv } from "@/lib/env";
import { getPaymentProvider, type PaymentProviderId } from "@/lib/payments";
import { processSuccessfulPayment } from "@/lib/payments/order-service";
import { rateLimit, requestIpHash } from "@/lib/security/request";
import { signAccessToken } from "@/lib/security/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function finalizeOrder(orderId: string, providerOrderId: string, raw: Record<string, unknown>) {
  const env = getServerEnv();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!order || !order.providerOrderId) {
    return NextResponse.redirect(`${getPublicAppUrl()}/payment/failed?reason=${encodeURIComponent("Payment order not found")}`);
  }
  if (order.providerOrderId !== providerOrderId) {
    return NextResponse.redirect(`${getPublicAppUrl()}/payment/failed?reason=${encodeURIComponent("Payment order mismatch")}`);
  }

  const paymentProvider = (order.payments[0]?.provider || env.PAYMENT_PROVIDER) as PaymentProviderId;
  const provider = getPaymentProvider(paymentProvider);
  const verified = await provider.verifyClientPayment(
    {
      internalOrderId: order.id,
      providerOrderId,
      expectedAmountPaise: Math.round(Number(order.totalAmount) * 100),
      raw,
    },
    order.providerOrderId,
    env,
  );

  if (!verified.ok) {
    return NextResponse.redirect(
      `${getPublicAppUrl()}/payment/failed?assessment=${order.assessmentId || ""}&reason=${encodeURIComponent(verified.reason)}`,
    );
  }

  const processed = await processSuccessfulPayment({
    orderId: order.id,
    providerPaymentId: verified.providerPaymentId,
    provider: provider.id,
  });
  const reportToken = await signAccessToken("report_access", processed.report.id, { leadId: order.leadId, orderId: order.id }, "72h");
  return NextResponse.redirect(
    `${getPublicAppUrl()}/payment/success?order=${encodeURIComponent(order.orderReference)}&report=${processed.report.id}&token=${encodeURIComponent(reportToken)}`,
  );
}

async function resolveOrder(providerOrderId: string | null, internalOrderId: string | null) {
  if (providerOrderId) {
    const byProvider = await prisma.order.findUnique({ where: { providerOrderId } });
    if (byProvider) return { order: byProvider, providerOrderId: byProvider.providerOrderId! };
  }
  if (internalOrderId) {
    const byInternal = await prisma.order.findUnique({ where: { id: internalOrderId } });
    if (byInternal?.providerOrderId) return { order: byInternal, providerOrderId: byInternal.providerOrderId };
  }
  return null;
}

function tooManyAttempts(request: NextRequest) {
  const ipHash = requestIpHash(request) ?? "unknown";
  return !rateLimit(`payment-return-ip:${ipHash}`, 40, 10 * 60 * 1000).allowed;
}

export async function GET(request: NextRequest) {
  if (tooManyAttempts(request)) {
    return NextResponse.redirect(`${getPublicAppUrl()}/payment/failed?reason=${encodeURIComponent("Too many payment return attempts")}`);
  }
  const providerOrderId = request.nextUrl.searchParams.get("order_id") || request.nextUrl.searchParams.get("txn") || "";
  const internalOrderId = request.nextUrl.searchParams.get("internalOrderId") || "";
  try {
    const resolved = await resolveOrder(providerOrderId || null, internalOrderId || null);
    if (!resolved) {
      return NextResponse.redirect(`${getPublicAppUrl()}/payment/failed?reason=${encodeURIComponent("Missing payment reference")}`);
    }
    return await finalizeOrder(resolved.order.id, resolved.providerOrderId, Object.fromEntries(request.nextUrl.searchParams.entries()));
  } catch (error) {
    console.error("payment_return_get_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.redirect(`${getPublicAppUrl()}/payment/failed?reason=${encodeURIComponent("Unable to finalize payment")}`);
  }
}

export async function POST(request: NextRequest) {
  if (tooManyAttempts(request)) {
    return NextResponse.redirect(`${getPublicAppUrl()}/payment/failed?reason=${encodeURIComponent("Too many payment return attempts")}`);
  }
  try {
    const contentType = request.headers.get("content-type") || "";
    let raw: Record<string, unknown> = {};
    if (contentType.includes("application/json")) {
      raw = (await request.json()) as Record<string, unknown>;
    } else {
      const form = await request.formData();
      raw = Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]));
    }
    const providerOrderId = String(raw.order_id || raw.txnid || raw.merchantTransactionId || raw.txn || "");
    const internalOrderId = String(raw.internalOrderId || "");
    const resolved = await resolveOrder(providerOrderId || null, internalOrderId || null);
    if (!resolved) {
      return NextResponse.redirect(`${getPublicAppUrl()}/payment/failed?reason=${encodeURIComponent("Missing payment reference")}`);
    }
    return await finalizeOrder(resolved.order.id, resolved.providerOrderId, raw);
  } catch (error) {
    console.error("payment_return_post_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.redirect(`${getPublicAppUrl()}/payment/failed?reason=${encodeURIComponent("Unable to finalize payment")}`);
  }
}
