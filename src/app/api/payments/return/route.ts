import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPublicAppUrl, getServerEnv } from "@/lib/env";
import { getPaymentProvider } from "@/lib/payments";
import { processSuccessfulPayment } from "@/lib/payments/order-service";
import { signAccessToken } from "@/lib/security/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function finalizeFromProviderOrder(providerOrderId: string, raw: Record<string, unknown>) {
  const env = getServerEnv();
  const provider = getPaymentProvider();
  const order = await prisma.order.findUnique({ where: { providerOrderId } });
  if (!order) {
    return NextResponse.redirect(`${getPublicAppUrl()}/payment/failed?reason=${encodeURIComponent("Payment order not found")}`);
  }

  const verified = await provider.verifyClientPayment(
    {
      internalOrderId: order.id,
      providerOrderId,
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

export async function GET(request: NextRequest) {
  const providerOrderId = request.nextUrl.searchParams.get("order_id") || request.nextUrl.searchParams.get("txn") || "";
  if (!providerOrderId) {
    return NextResponse.redirect(`${getPublicAppUrl()}/payment/failed?reason=${encodeURIComponent("Missing payment reference")}`);
  }
  try {
    return await finalizeFromProviderOrder(providerOrderId, Object.fromEntries(request.nextUrl.searchParams.entries()));
  } catch (error) {
    console.error("payment_return_get_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.redirect(`${getPublicAppUrl()}/payment/failed?reason=${encodeURIComponent("Unable to finalize payment")}`);
  }
}

export async function POST(request: NextRequest) {
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
    if (!providerOrderId) {
      return NextResponse.redirect(`${getPublicAppUrl()}/payment/failed?reason=${encodeURIComponent("Missing payment reference")}`);
    }
    return await finalizeFromProviderOrder(providerOrderId, raw);
  } catch (error) {
    console.error("payment_return_post_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.redirect(`${getPublicAppUrl()}/payment/failed?reason=${encodeURIComponent("Unable to finalize payment")}`);
  }
}
