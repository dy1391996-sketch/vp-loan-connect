import { createHmac, timingSafeEqual } from "node:crypto";
import type { ServerEnv } from "@/lib/env";
import {
  PaymentConfigurationError,
  PaymentProviderError,
  type ClientVerifyPayload,
  type CreateOrderResult,
  type PaymentProvider,
  type PaymentStatusResult,
  type RefundInput,
  type WebhookParseResult,
} from "@/lib/payments/types";

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
      error?: { description?: string; code?: string; reason?: string };
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

function razorpayMissing(env: ServerEnv) {
  const missing: string[] = [];
  if (!env.RAZORPAY_KEY_ID) missing.push("RAZORPAY_KEY_ID");
  if (!env.RAZORPAY_KEY_SECRET) missing.push("RAZORPAY_KEY_SECRET");
  if (!env.RAZORPAY_WEBHOOK_SECRET) missing.push("RAZORPAY_WEBHOOK_SECRET");
  return missing;
}

export const razorpayPaymentProvider: PaymentProvider = {
  id: "razorpay",
  displayName: "Razorpay",

  missingCredentials(env) {
    return razorpayMissing(env);
  },

  assertConfigured(env) {
    const missing = razorpayMissing(env).filter((key) => key !== "RAZORPAY_WEBHOOK_SECRET");
    // Order create needs key id/secret; webhook secret required for live webhook processing.
    if (missing.length) throw new PaymentConfigurationError("razorpay", missing);
    const keyId = env.RAZORPAY_KEY_ID;
    if (!keyId.startsWith("rzp_test_") && !keyId.startsWith("rzp_live_")) {
      throw new PaymentProviderError("Razorpay KEY_ID looks invalid (must start with rzp_test_ or rzp_live_).", 502);
    }
    if (env.RAZORPAY_KEY_SECRET.length < 20) {
      throw new PaymentProviderError("Razorpay KEY_SECRET looks too short — paste the full secret from the Razorpay dashboard.", 502);
    }
  },

  async createOrder(input, env) {
    this.assertConfigured(env);
    const keyId = env.RAZORPAY_KEY_ID;
    const keySecret = env.RAZORPAY_KEY_SECRET;
    const keyMode = keyId.startsWith("rzp_live_") ? "live" : "test";
    const receipt = input.receipt.slice(0, 40);
    const amountPaise = Math.round(input.amountPaise);
    if (!Number.isFinite(amountPaise) || amountPaise < 100) {
      throw new PaymentProviderError(`Invalid payment amount (${amountPaise} paise).`, 400);
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
        throw new PaymentProviderError(
          `Razorpay authentication failed (${response.status}, ${keyMode} keys). Check KEY_ID/KEY_SECRET are a matching pair from the same Razorpay mode.`,
          502,
        );
      }
      throw new PaymentProviderError(`Razorpay order creation failed (${response.status}): ${detail}`, 502);
    }

    const data = (await response.json()) as { id?: string };
    if (!data.id) throw new PaymentProviderError("Razorpay did not return an order id.", 502);

    const result: CreateOrderResult = {
      provider: "razorpay",
      providerOrderId: data.id,
      amountPaise,
      currency: "INR",
      keyId,
      checkout: { mode: "razorpay_modal", keyId, orderId: data.id },
    };
    return result;
  },

  async verifyClientPayment(payload: ClientVerifyPayload, orderProviderOrderId, env) {
    const raw = payload.raw ?? {};
    const providerOrderId =
      payload.providerOrderId ||
      (typeof raw.razorpay_order_id === "string" ? raw.razorpay_order_id : "") ||
      "";
    const providerPaymentId =
      payload.providerPaymentId ||
      (typeof raw.razorpay_payment_id === "string" ? raw.razorpay_payment_id : "") ||
      "";
    const signature =
      payload.signature || (typeof raw.razorpay_signature === "string" ? raw.razorpay_signature : "") || "";

    if (!providerOrderId || !providerPaymentId || !signature) {
      return { ok: false, reason: "Invalid payment response." };
    }
    if (!orderProviderOrderId || orderProviderOrderId !== providerOrderId) {
      return { ok: false, reason: "Payment order mismatch." };
    }
    if (!env.RAZORPAY_KEY_SECRET) {
      return { ok: false, reason: "Payment verification is not configured." };
    }
    if (!verifyRazorpayPaymentSignature(providerOrderId, providerPaymentId, signature, env.RAZORPAY_KEY_SECRET)) {
      return { ok: false, reason: "Payment signature verification failed." };
    }
    return { ok: true, providerOrderId, providerPaymentId };
  },

  verifyWebhookSignature(rawBody, headers, env) {
    if (!env.RAZORPAY_WEBHOOK_SECRET) return false;
    const signature = headers.get("x-razorpay-signature") ?? "";
    return verifyRazorpayWebhookSignature(rawBody, signature, env.RAZORPAY_WEBHOOK_SECRET);
  },

  parseWebhook(rawBody, headers): WebhookParseResult {
    let body: {
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            order_id?: string;
            error_code?: string;
            error_description?: string;
          };
        };
      };
    };
    try {
      body = JSON.parse(rawBody) as typeof body;
    } catch {
      return { kind: "ignored", reason: "invalid_json" };
    }

    const entity = body.payload?.payment?.entity;
    const providerEventId =
      headers.get("x-razorpay-event-id") || `${body.event ?? "unknown"}:${entity?.id ?? "na"}`;

    if (body.event === "payment.captured" && entity?.id && entity.order_id) {
      return {
        kind: "payment_captured",
        providerEventId,
        providerOrderId: entity.order_id,
        providerPaymentId: entity.id,
      };
    }
    if (body.event === "payment.failed" && entity?.order_id) {
      return {
        kind: "payment_failed",
        providerEventId,
        providerOrderId: entity.order_id,
        providerPaymentId: entity.id,
        failureCode: entity.error_code,
        failureDescription: entity.error_description,
      };
    }
    return { kind: "ignored", reason: body.event || "unhandled_event" };
  },

  async getPaymentStatus(providerPaymentId, env): Promise<PaymentStatusResult> {
    this.assertConfigured(env);
    const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(providerPaymentId)}`, {
      headers: { authorization: razorpayAuthHeader(env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET) },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new PaymentProviderError(`Razorpay payment status failed (${response.status}).`, 502);
    }
    const data = (await response.json()) as { id?: string; order_id?: string; status?: string };
    const map: Record<string, PaymentStatusResult["status"]> = {
      created: "created",
      authorized: "authorized",
      captured: "captured",
      failed: "failed",
      refunded: "refunded",
    };
    return {
      providerPaymentId: data.id || providerPaymentId,
      providerOrderId: data.order_id,
      status: map[data.status || ""] ?? "unknown",
      rawStatus: data.status,
    };
  },

  async createRefund(input: RefundInput, env) {
    this.assertConfigured(env);
    const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(input.paymentId)}/refund`, {
      method: "POST",
      headers: {
        authorization: razorpayAuthHeader(env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET),
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
      throw new PaymentProviderError(`Razorpay refund failed (${response.status}): ${detail}`, 502);
    }
    const data = (await response.json()) as { id: string };
    return { refundId: data.id };
  },
};

