import { createHmac, timingSafeEqual } from "node:crypto";
import { getServerEnv } from "@/lib/env";

export function verifyRazorpayPaymentSignature(orderId: string, paymentId: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

export function verifyRazorpayWebhookSignature(rawBody: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}

function safeEqualHex(a: string, b: string) {
  try { const first = Buffer.from(a, "hex"); const second = Buffer.from(b, "hex"); return first.length === second.length && timingSafeEqual(first, second); } catch { return false; }
}

export async function createProviderOrder(input: { amountPaise: number; receipt: string; notes: Record<string, string> }) {
  const env = getServerEnv();
  if (env.PAYMENT_PROVIDER === "mock") {
    if (env.NODE_ENV === "production") throw new Error("Mock payments are disabled in production.");
    return { provider: "mock" as const, orderId: `mock_order_${crypto.randomUUID()}`, keyId: "mock" };
  }
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { authorization: `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64")}`, "content-type": "application/json" },
    body: JSON.stringify({ amount: input.amountPaise, currency: "INR", receipt: input.receipt, notes: input.notes }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Razorpay order creation failed (${response.status}).`);
  const data = (await response.json()) as { id: string };
  return { provider: "razorpay" as const, orderId: data.id, keyId: env.RAZORPAY_KEY_ID };
}

export async function createProviderRefund(input: { paymentId: string; amountPaise: number; refundReference: string }) {
  const env = getServerEnv();
  if (env.PAYMENT_PROVIDER === "mock") {
    if (env.NODE_ENV === "production") throw new Error("Mock refunds are disabled in production.");
    return { refundId: `mock_refund_${crypto.randomUUID()}` };
  }
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(input.paymentId)}/refund`, {
    method: "POST",
    headers: { authorization: `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64")}`, "content-type": "application/json" },
    body: JSON.stringify({ amount: input.amountPaise, speed: "normal", receipt: input.refundReference, notes: { internal_refund_reference: input.refundReference } }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Razorpay refund failed (${response.status}).`);
  const data = (await response.json()) as { id: string };
  return { refundId: data.id };
}
