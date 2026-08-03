import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPublicAppUrl, getServerEnv } from "@/lib/env";
import { getPaymentProvider, type PaymentProviderId } from "@/lib/payments";
import { processSuccessfulPayment } from "@/lib/payments/order-service";
import { rateLimit, requestIpHash } from "@/lib/security/request";
import { signAccessToken } from "@/lib/security/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_REDIRECT_PREFIXES = ["/payment/success", "/payment/pending", "/payment/failed"] as const;

function publicRedirect(path: `/payment/${"success" | "pending" | "failed"}`, query: Record<string, string>) {
  if (!ALLOWED_REDIRECT_PREFIXES.includes(path)) {
    return NextResponse.redirect(`${getPublicAppUrl()}/payment/failed?reason=${encodeURIComponent("Invalid redirect")}`);
  }
  const url = new URL(path, getPublicAppUrl());
  for (const [key, value] of Object.entries(query)) {
    if (value) url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

function isPendingReason(reason: string) {
  return /not paid yet|not successful yet|PENDING|NOT_ATTEMPTED|unable to confirm cashfree payment status/i.test(reason);
}

async function finalizeOrder(orderId: string, providerOrderId: string, raw: Record<string, unknown>) {
  const env = getServerEnv();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payments: { orderBy: { createdAt: "desc" }, take: 1 }, reports: { select: { id: true }, take: 1 } },
  });
  if (!order || !order.providerOrderId) {
    return publicRedirect("/payment/failed", { reason: "Payment order not found" });
  }
  if (order.providerOrderId !== providerOrderId) {
    return publicRedirect("/payment/failed", { reason: "Payment order mismatch" });
  }

  if (order.status === "PAID" && order.reports[0]) {
    const reportToken = await signAccessToken("report_access", order.reports[0].id, { leadId: order.leadId, orderId: order.id }, "72h");
    return publicRedirect("/payment/success", {
      order: order.orderReference,
      report: order.reports[0].id,
      token: reportToken,
    });
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
    if (isPendingReason(verified.reason) && order.assessmentId) {
      const pendingToken = await signAccessToken("result_access", order.assessmentId, { leadId: order.leadId }, "2h");
      return publicRedirect("/payment/pending", {
        order: order.orderReference,
        assessment: order.assessmentId,
        token: pendingToken,
        reason: verified.reason,
      });
    }
    return publicRedirect("/payment/failed", {
      assessment: order.assessmentId || "",
      reason: verified.reason,
    });
  }

  const processed = await processSuccessfulPayment({
    orderId: order.id,
    providerPaymentId: verified.providerPaymentId,
    provider: provider.id,
  });
  const reportToken = await signAccessToken("report_access", processed.report.id, { leadId: order.leadId, orderId: order.id }, "72h");
  return publicRedirect("/payment/success", {
    order: order.orderReference,
    report: processed.report.id,
    token: reportToken,
  });
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
    return publicRedirect("/payment/failed", { reason: "Too many payment return attempts" });
  }
  const providerOrderId = request.nextUrl.searchParams.get("order_id") || request.nextUrl.searchParams.get("txn") || "";
  const internalOrderId = request.nextUrl.searchParams.get("internalOrderId") || "";
  try {
    const resolved = await resolveOrder(providerOrderId || null, internalOrderId || null);
    if (!resolved) {
      return publicRedirect("/payment/failed", { reason: "Missing payment reference" });
    }
    return await finalizeOrder(resolved.order.id, resolved.providerOrderId, Object.fromEntries(request.nextUrl.searchParams.entries()));
  } catch (error) {
    console.error("payment_return_get_failed", error instanceof Error ? error.message : "unknown");
    return publicRedirect("/payment/failed", { reason: "Unable to finalize payment" });
  }
}

export async function POST(request: NextRequest) {
  if (tooManyAttempts(request)) {
    return publicRedirect("/payment/failed", { reason: "Too many payment return attempts" });
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
      return publicRedirect("/payment/failed", { reason: "Missing payment reference" });
    }
    return await finalizeOrder(resolved.order.id, resolved.providerOrderId, raw);
  } catch (error) {
    console.error("payment_return_post_failed", error instanceof Error ? error.message : "unknown");
    return publicRedirect("/payment/failed", { reason: "Unable to finalize payment" });
  }
}
