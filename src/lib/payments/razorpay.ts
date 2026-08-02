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
  try {
    const first = Buffer.from(a, "hex");
    const second = Buffer.from(b, "hex");
    return first.length === second.length && timingSafeEqual(first, second);
  } catch {
    return false;
  }
}

function razorpayAuthHeader(keyId: string, keySecret: string) {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

async function readRazorpayError(response: Response) {
  try {
    const data = (await response.json()) as {
      error?: { description?: string; code?: string; reason?: string; field?: string };
      description?: string;
    };
    const description = data.error?.description || data.description || "";
    const code = data.error?.code || "";
    const reason = data.error?.reason || "";
    return [code, reason, description].filter(Boolean).join(" — ") || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

export async function createProviderOrder(input: {
  amountPaise: number;
  receipt: string;
  notes: Record<string, string>;
}) {
  const env = getServerEnv();
  if (env.PAYMENT_PROVIDER === "mock") {
    if (env.NODE_ENV === "production") throw new Error("Mock payments are disabled in production.");
    return { provider: "mock" as const, orderId: `mock_order_${crypto.randomUUID()}`, keyId: "mock" };
  }

  const keyId = env.RAZORPAY_KEY_ID.trim();
  const keySecret = env.RAZORPAY_KEY_SECRET.trim();
  if (!keyId || !keySecret) throw new Error("Razorpay order credentials are not configured.");
  if (!keyId.startsWith("rzp_")) throw new Error("Razorpay KEY_ID looks invalid (must start with rzp_test_ or rzp_live_).");

  // Razorpay receipt max length is 40.
  const receipt = input.receipt.slice(0, 40);
  const amountPaise = Math.round(input.amountPaise);
  if (!Number.isFinite(amountPaise) || amountPaise < 100) {
    throw new Error(`Invalid payment amount (${amountPaise} paise).`);
  }

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      authorization: razorpayAuthHeader(keyId, keySecret),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes: input.notes,
      payment_capture: 1,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const detail = await readRazorpayError(response);
    console.error("razorpay_order_create_failed", { status: response.status, detail, receipt, amountPaise });
    if (response.status === 401 || response.status === 403) {
      throw new Error(`Razorpay authentication failed (${response.status}). Check KEY_ID/KEY_SECRET match (both test or both live).`);
    }
    throw new Error(`Razorpay order creation failed (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as { id?: string };
  if (!data.id) throw new Error("Razorpay did not return an order id.");
  return { provider: "razorpay" as const, orderId: data.id, keyId };
}

export async function createProviderRefund(input: { paymentId: string; amountPaise: number; refundReference: string }) {
  const env = getServerEnv();
  if (env.PAYMENT_PROVIDER === "mock") {
    if (env.NODE_ENV === "production") throw new Error("Mock refunds are disabled in production.");
    return { refundId: `mock_refund_${crypto.randomUUID()}` };
  }
  const keyId = env.RAZORPAY_KEY_ID.trim();
  const keySecret = env.RAZORPAY_KEY_SECRET.trim();
  if (!keyId || !keySecret) throw new Error("Razorpay refund credentials are not configured.");
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(input.paymentId)}/refund`, {
    method: "POST",
    headers: {
      authorization: razorpayAuthHeader(keyId, keySecret),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amountPaise,
      speed: "normal",
      receipt: input.refundReference.slice(0, 40),
      notes: { internal_refund_reference: input.refundReference },
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    const detail = await readRazorpayError(response);
    throw new Error(`Razorpay refund failed (${response.status}): ${detail}`);
  }
  const data = (await response.json()) as { id: string };
  return { refundId: data.id };
}
