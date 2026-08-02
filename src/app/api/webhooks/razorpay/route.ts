import { NextRequest } from "next/server";
import { handlePaymentWebhook } from "@/lib/payments/webhook-handler";

/** Backward-compatible Razorpay webhook URL. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handlePaymentWebhook("razorpay", request);
}
