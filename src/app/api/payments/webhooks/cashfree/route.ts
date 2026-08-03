import { NextRequest } from "next/server";
import { handlePaymentWebhook } from "@/lib/payments/webhook-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Alias endpoint for Cashfree dashboard notify_url (canonical route remains /api/webhooks/payments/cashfree). */
export async function POST(request: NextRequest) {
  return handlePaymentWebhook("cashfree", request);
}
