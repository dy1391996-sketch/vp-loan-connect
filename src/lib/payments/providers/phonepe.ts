import { createHash, timingSafeEqual } from "node:crypto";
import type { ServerEnv } from "@/lib/env";
import { getPublicAppUrl } from "@/lib/env";
import {
  PaymentConfigurationError,
  PaymentProviderError,
  type ClientVerifyPayload,
  type CreateOrderInput,
  type PaymentProvider,
  type PaymentStatusResult,
  type RefundInput,
  type WebhookParseResult,
} from "@/lib/payments/types";
function phonepeMissing(env: ServerEnv) {
  const missing: string[] = [];
  if (!env.PHONEPE_MERCHANT_ID) missing.push("PHONEPE_MERCHANT_ID");
  if (!env.PHONEPE_SALT_KEY) missing.push("PHONEPE_SALT_KEY");
  if (!env.PHONEPE_SALT_INDEX) missing.push("PHONEPE_SALT_INDEX");
  return missing;
}

function phonepeBaseUrl(env: ServerEnv) {
  return env.PHONEPE_ENV === "production" ? "https://api.phonepe.com/apis/hermes" : "https://api-preprod.phonepe.com/apis/pg-sandbox";
}

function phonepeChecksum(payloadBase64: string, path: string, saltKey: string, saltIndex: string) {
  const hash = createHash("sha256").update(`${payloadBase64}${path}${saltKey}`).digest("hex");
  return `${hash}###${saltIndex}`;
}

function safeEqual(a: string, b: string) {
  try {
    const first = Buffer.from(a);
    const second = Buffer.from(b);
    return first.length === second.length && timingSafeEqual(first, second);
  } catch {
    return false;
  }
}

async function readPhonePeError(response: Response) {
  try {
    const data = (await response.json()) as { message?: string; code?: string };
    return [data.code, data.message].filter(Boolean).join(" — ") || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

export const phonepePaymentProvider: PaymentProvider = {
  id: "phonepe",
  displayName: "PhonePe Payment Gateway",

  missingCredentials(env) {
    return phonepeMissing(env);
  },

  assertConfigured(env) {
    const missing = phonepeMissing(env);
    if (missing.length) throw new PaymentConfigurationError("phonepe", missing);
  },

  async createOrder(input: CreateOrderInput, env: ServerEnv) {
    this.assertConfigured(env);
    const amountPaise = Math.round(input.amountPaise);
    if (!Number.isFinite(amountPaise) || amountPaise < 100) {
      throw new PaymentProviderError(`Invalid payment amount (${amountPaise} paise).`, 400);
    }

    const merchantTransactionId = (input.notes.internal_order_id || input.receipt).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 34);
    const mobile = (input.customer?.mobile || "").replace(/\D/g, "").slice(-10);
    const callbackUrl = input.notifyUrl || `${getPublicAppUrl()}/api/webhooks/payments/phonepe`;
    const redirectUrl = input.returnUrl || `${getPublicAppUrl()}/api/payments/phonepe/return?txn=${encodeURIComponent(merchantTransactionId)}`;

    const payload = {
      merchantId: env.PHONEPE_MERCHANT_ID,
      merchantTransactionId,
      merchantUserId: merchantTransactionId.slice(0, 36),
      amount: amountPaise,
      redirectUrl,
      redirectMode: "POST",
      callbackUrl,
      mobileNumber: mobile || undefined,
      paymentInstrument: { type: "PAY_PAGE" },
    };

    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64");
    const path = "/pg/v1/pay";
    const xVerify = phonepeChecksum(payloadBase64, path, env.PHONEPE_SALT_KEY, env.PHONEPE_SALT_INDEX);

    const response = await fetch(`${phonepeBaseUrl(env)}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-VERIFY": xVerify,
      },
      body: JSON.stringify({ request: payloadBase64 }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const detail = await readPhonePeError(response);
      console.error("phonepe_order_create_failed", { status: response.status, detail });
      throw new PaymentProviderError(`PhonePe order creation failed (${response.status}): ${detail}`, 502);
    }

    const data = (await response.json()) as {
      success?: boolean;
      code?: string;
      data?: {
        merchantTransactionId?: string;
        instrumentResponse?: { redirectInfo?: { url?: string } };
      };
    };

    const redirect = data.data?.instrumentResponse?.redirectInfo?.url;
    if (!data.success || !redirect) {
      throw new PaymentProviderError(`PhonePe did not return a redirect URL (${data.code || "unknown"}).`, 502);
    }

    return {
      provider: "phonepe" as const,
      providerOrderId: data.data?.merchantTransactionId || merchantTransactionId,
      amountPaise,
      currency: "INR" as const,
      checkout: { mode: "phonepe_redirect" as const, redirectUrl: redirect },
    };
  },

  async verifyClientPayment(payload: ClientVerifyPayload, orderProviderOrderId, env) {
    this.assertConfigured(env);
    const providerOrderId =
      payload.providerOrderId ||
      (typeof payload.raw?.merchantTransactionId === "string" ? payload.raw.merchantTransactionId : "") ||
      "";
    if (!providerOrderId || orderProviderOrderId !== providerOrderId) {
      return { ok: false, reason: "Payment order mismatch." };
    }

    const path = `/pg/v1/status/${env.PHONEPE_MERCHANT_ID}/${encodeURIComponent(providerOrderId)}`;
    const xVerify = createHash("sha256").update(`${path}${env.PHONEPE_SALT_KEY}`).digest("hex") + `###${env.PHONEPE_SALT_INDEX}`;
    const response = await fetch(`${phonepeBaseUrl(env)}${path}`, {
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": xVerify,
        "X-MERCHANT-ID": env.PHONEPE_MERCHANT_ID,
      },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, reason: "Unable to confirm PhonePe payment status." };
    const data = (await response.json()) as {
      success?: boolean;
      code?: string;
      data?: { transactionId?: string; state?: string; merchantTransactionId?: string };
    };
    if (!data.success || data.data?.state !== "COMPLETED") {
      return { ok: false, reason: "PhonePe payment is not completed yet." };
    }
    return {
      ok: true,
      providerOrderId: data.data.merchantTransactionId || providerOrderId,
      providerPaymentId: data.data.transactionId || providerOrderId,
    };
  },

  verifyWebhookSignature(rawBody, headers, env) {
    if (!env.PHONEPE_SALT_KEY) return false;
    const signature = headers.get("x-verify") || headers.get("X-VERIFY") || "";
    if (!signature) return false;
    // PhonePe callbacks often send base64 body in { response: "..." }.
    let encoded = rawBody;
    try {
      const parsed = JSON.parse(rawBody) as { response?: string };
      if (typeof parsed.response === "string") encoded = parsed.response;
    } catch {
      // use raw body
    }
    const expected = createHash("sha256").update(`${encoded}${env.PHONEPE_SALT_KEY}`).digest("hex") + `###${env.PHONEPE_SALT_INDEX}`;
    return safeEqual(expected, signature);
  },

  parseWebhook(rawBody): WebhookParseResult {
    try {
      const wrapper = JSON.parse(rawBody) as { response?: string };
      const decoded = wrapper.response
        ? (JSON.parse(Buffer.from(wrapper.response, "base64").toString("utf8")) as {
            code?: string;
            data?: { merchantTransactionId?: string; transactionId?: string; state?: string; responseCode?: string };
          })
        : (wrapper as {
            code?: string;
            data?: { merchantTransactionId?: string; transactionId?: string; state?: string; responseCode?: string };
          });

      const orderId = decoded.data?.merchantTransactionId;
      const paymentId = decoded.data?.transactionId;
      const state = decoded.data?.state;
      const providerEventId = `${orderId || "na"}:${paymentId || "na"}:${state || decoded.code || "event"}`;

      if (orderId && paymentId && state === "COMPLETED") {
        return { kind: "payment_captured", providerEventId, providerOrderId: orderId, providerPaymentId: paymentId };
      }
      if (orderId && (state === "FAILED" || decoded.code === "PAYMENT_ERROR")) {
        return {
          kind: "payment_failed",
          providerEventId,
          providerOrderId: orderId,
          providerPaymentId: paymentId,
          failureCode: decoded.data?.responseCode || decoded.code,
        };
      }
      return { kind: "ignored", reason: state || decoded.code || "unhandled_event" };
    } catch {
      return { kind: "ignored", reason: "invalid_json" };
    }
  },

  async getPaymentStatus(providerPaymentId, env): Promise<PaymentStatusResult> {
    // PhonePe status API needs merchantTransactionId; callers should pass that id.
    const verified = await this.verifyClientPayment(
      { internalOrderId: "00000000-0000-0000-0000-000000000000", providerOrderId: providerPaymentId },
      providerPaymentId,
      env,
    );
    if (!verified.ok) {
      return { providerPaymentId, status: "unknown", rawStatus: verified.reason };
    }
    return {
      providerPaymentId: verified.providerPaymentId,
      providerOrderId: verified.providerOrderId,
      status: "captured",
      rawStatus: "COMPLETED",
    };
  },

  async createRefund(input: RefundInput, env) {
    this.assertConfigured(env);
    // PhonePe refund requires original merchantTransactionId; store paymentId as gateway txn id.
    // This is a readiness placeholder that reports clearly when payload is incomplete for live refund calls.
    if (!input.paymentId) throw new PaymentProviderError("PhonePe refund requires the original provider payment/transaction id.", 400);
    throw new PaymentProviderError(
      "PhonePe refund API is prepared but needs merchant refund payload mapping from your PhonePe merchant dashboard settings. Collect PHONEPE credentials and confirm refund API access before enabling admin refunds for PhonePe.",
      501,
    );
  },
};
