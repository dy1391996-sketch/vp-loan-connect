import { NextRequest } from "next/server";
import { handlePaymentWebhook } from "@/lib/payments/webhook-handler";
import type { PaymentProviderId } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowed: PaymentProviderId[] = ["razorpay", "cashfree", "phonepe", "payu"];

export async function POST(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  if (!allowed.includes(provider as PaymentProviderId)) {
    return Response.json({ error: "Unknown payment provider webhook." }, { status: 404 });
  }
  return handlePaymentWebhook(provider as PaymentProviderId, request);
}
