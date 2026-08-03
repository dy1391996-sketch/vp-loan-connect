import { createHmac, timingSafeEqual } from "node:crypto";
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

function cashfreeMissing(env: ServerEnv) {
  const missing: string[] = [];
  if (!env.CASHFREE_APP_ID) missing.push("CASHFREE_APP_ID");
  if (!env.CASHFREE_SECRET_KEY) missing.push("CASHFREE_SECRET_KEY");
  return missing;
}

function cashfreeBaseUrl(env: ServerEnv) {
  return env.CASHFREE_ENV === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
}

function cashfreeHeaders(env: ServerEnv) {
  return {
    "content-type": "application/json",
    "x-client-id": env.CASHFREE_APP_ID,
    "x-client-secret": env.CASHFREE_SECRET_KEY,
    "x-api-version": "2023-08-01",
  };
}

/** Exported for unit tests. Signature = base64(HMAC_SHA256(timestamp + rawBody)). */
export function verifyCashfreeWebhookSignature(rawBody: string, timestamp: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(`${timestamp}${rawBody}`).digest("base64");
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function webhookTimestampFresh(timestamp: string, maxSkewMs = 15 * 60 * 1000) {
  const raw = Number(timestamp);
  if (!Number.isFinite(raw) || raw <= 0) return false;
  const ms = raw < 1e12 ? raw * 1000 : raw;
  return Math.abs(Date.now() - ms) <= maxSkewMs;
}

async function readCashfreeError(response: Response) {
  try {
    const data = (await response.json()) as { message?: string; code?: string };
    return [data.code, data.message].filter(Boolean).join(" — ") || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

function amountsMatchRupees(paid: number | undefined, expectedPaise: number | undefined) {
  if (expectedPaise == null || !Number.isFinite(expectedPaise)) return true;
  if (paid == null || !Number.isFinite(paid)) return false;
  const paidPaise = Math.round(Number(paid) * 100);
  return Math.abs(paidPaise - expectedPaise) <= 1;
}

export const cashfreePaymentProvider: PaymentProvider = {
  id: "cashfree",
  displayName: "Cashfree Payments",

  missingCredentials(env) {
    return cashfreeMissing(env);
  },

  assertConfigured(env) {
    const missing = cashfreeMissing(env);
    if (missing.length) throw new PaymentConfigurationError("cashfree", missing);
  },

  async createOrder(input: CreateOrderInput, env: ServerEnv) {
    this.assertConfigured(env);
    const amountPaise = Math.round(input.amountPaise);
    if (!Number.isFinite(amountPaise) || amountPaise < 100) {
      throw new PaymentProviderError(`Invalid payment amount (${amountPaise} paise).`, 400);
    }
    const customerPhone = (input.customer?.mobile || "").replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(customerPhone)) {
      throw new PaymentProviderError("A valid customer mobile number is required for Cashfree checkout.", 400);
    }
    const customerEmail = (input.customer?.email || "").trim();
    if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      throw new PaymentProviderError("A verified customer email is required for Cashfree checkout.", 400);
    }
    const orderAmount = (amountPaise / 100).toFixed(2);
    const orderId = (input.notes.internal_order_id || input.receipt).slice(0, 45);
    // Cashfree replaces `{order_id}` in return_url after payment; keep internalOrderId for recovery.
    const returnUrl =
      input.returnUrl ||
      `${getPublicAppUrl()}/api/payments/return?order_id={order_id}`;

    const response = await fetch(`${cashfreeBaseUrl(env)}/orders`, {
      method: "POST",
      headers: cashfreeHeaders(env),
      body: JSON.stringify({
        order_id: orderId,
        order_amount: Number(orderAmount),
        order_currency: "INR",
        order_note: input.receipt,
        customer_details: {
          customer_id: (input.notes.internal_order_id || orderId).slice(0, 50),
          customer_phone: customerPhone,
          customer_name: input.customer?.name || "VP Loan Connect Customer",
          customer_email: customerEmail,
        },
        order_meta: {
          return_url: returnUrl,
          notify_url: input.notifyUrl,
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const detail = await readCashfreeError(response);
      console.error("cashfree_order_create_failed", { status: response.status, detail });
      throw new PaymentProviderError(`Cashfree order creation failed (${response.status}): ${detail}`, 502);
    }

    const data = (await response.json()) as {
      order_id?: string;
      payment_session_id?: string;
      cf_order_id?: string | number;
    };
    if (!data.payment_session_id || !data.order_id) {
      throw new PaymentProviderError("Cashfree did not return payment_session_id.", 502);
    }

    return {
      provider: "cashfree" as const,
      providerOrderId: data.order_id,
      amountPaise,
      currency: "INR" as const,
      checkout: {
        mode: "cashfree_checkout" as const,
        paymentSessionId: data.payment_session_id,
        env: env.CASHFREE_ENV === "production" ? ("production" as const) : ("sandbox" as const),
      },
    };
  },

  async verifyClientPayment(payload: ClientVerifyPayload, orderProviderOrderId, env) {
    this.assertConfigured(env);
    const raw = payload.raw ?? {};
    const providerOrderId =
      payload.providerOrderId ||
      (typeof raw.order_id === "string" ? raw.order_id : "") ||
      (typeof raw.orderId === "string" ? raw.orderId : "") ||
      "";
    if (!providerOrderId || orderProviderOrderId !== providerOrderId) {
      return { ok: false as const, reason: "Payment order mismatch." };
    }

    const response = await fetch(`${cashfreeBaseUrl(env)}/orders/${encodeURIComponent(providerOrderId)}/payments`, {
      headers: cashfreeHeaders(env),
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false as const, reason: "Unable to confirm Cashfree payment status." };
    }
    const payments = (await response.json()) as Array<{
      cf_payment_id?: string | number;
      payment_status?: string;
      payment_amount?: number;
      payment_currency?: string;
    }>;
    const success = (Array.isArray(payments) ? payments : []).find((item) =>
      ["SUCCESS", "PAID"].includes(String(item.payment_status || "").toUpperCase()),
    );
    if (!success?.cf_payment_id) {
      return { ok: false as const, reason: "Cashfree payment is not successful yet." };
    }
    if (success.payment_currency && String(success.payment_currency).toUpperCase() !== "INR") {
      return { ok: false as const, reason: "Payment currency mismatch." };
    }
    if (!amountsMatchRupees(success.payment_amount, payload.expectedAmountPaise)) {
      console.error("cashfree_amount_mismatch", {
        orderId: providerOrderId,
        expectedPaise: payload.expectedAmountPaise,
        paid: success.payment_amount,
      });
      return { ok: false as const, reason: "Payment amount mismatch." };
    }
    return {
      ok: true as const,
      providerOrderId,
      providerPaymentId: String(success.cf_payment_id),
    };
  },

  verifyWebhookSignature(rawBody, headers, env) {
    // Cashfree PG webhooks are signed with the client secret (x-client-secret).
    const secret = env.CASHFREE_WEBHOOK_SECRET || env.CASHFREE_SECRET_KEY;
    if (!secret) return false;
    const signature = headers.get("x-webhook-signature") || headers.get("x-cashfree-signature") || "";
    const timestamp = headers.get("x-webhook-timestamp") || headers.get("x-cashfree-timestamp") || "";
    if (!signature || !timestamp) return false;
    if (!webhookTimestampFresh(timestamp)) {
      console.warn("cashfree_webhook_stale_timestamp");
      return false;
    }
    return verifyCashfreeWebhookSignature(rawBody, timestamp, signature, secret);
  },

  parseWebhook(rawBody, headers): WebhookParseResult {
    let body: {
      type?: string;
      event_time?: string;
      data?: {
        order?: { order_id?: string; order_amount?: number; order_currency?: string };
        payment?: {
          cf_payment_id?: string | number;
          payment_status?: string;
          payment_message?: string;
          payment_amount?: number;
          payment_currency?: string;
        };
      };
    };
    try {
      body = JSON.parse(rawBody) as typeof body;
    } catch {
      return { kind: "ignored", reason: "invalid_json" };
    }

    const orderId = body.data?.order?.order_id;
    const paymentId = body.data?.payment?.cf_payment_id;
    const status = String(body.data?.payment?.payment_status || "").toUpperCase();
    const eventType = String(body.type || "");
    const providerEventId = headers.get("x-webhook-id") || `${eventType || "cashfree"}:${paymentId || orderId || "na"}`;

    const successEvent =
      eventType === "PAYMENT_SUCCESS_WEBHOOK" ||
      eventType.includes("PAYMENT_SUCCESS") ||
      status === "SUCCESS" ||
      status === "PAID";
    const failedEvent =
      eventType === "PAYMENT_FAILED_WEBHOOK" ||
      eventType.includes("PAYMENT_FAILED") ||
      eventType.includes("USER_DROPPED") ||
      status === "FAILED" ||
      status === "USER_DROPPED" ||
      status === "CANCELLED";

    if (orderId && paymentId && successEvent && !failedEvent) {
      const currency = body.data?.payment?.payment_currency || body.data?.order?.order_currency;
      if (currency && String(currency).toUpperCase() !== "INR") {
        return { kind: "ignored", reason: "currency_mismatch" };
      }
      return {
        kind: "payment_captured",
        providerEventId,
        providerOrderId: orderId,
        providerPaymentId: String(paymentId),
      };
    }
    if (orderId && failedEvent) {
      return {
        kind: "payment_failed",
        providerEventId,
        providerOrderId: orderId,
        providerPaymentId: paymentId ? String(paymentId) : undefined,
        failureDescription: body.data?.payment?.payment_message || status,
      };
    }
    return { kind: "ignored", reason: eventType || "unhandled_event" };
  },

  async getPaymentStatus(providerPaymentId, env): Promise<PaymentStatusResult> {
    this.assertConfigured(env);
    const response = await fetch(`${cashfreeBaseUrl(env)}/payments/${encodeURIComponent(providerPaymentId)}`, {
      headers: cashfreeHeaders(env),
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!response.ok) throw new PaymentProviderError(`Cashfree payment status failed (${response.status}).`, 502);
    const data = (await response.json()) as {
      cf_payment_id?: string | number;
      order_id?: string;
      payment_status?: string;
    };
    const status = String(data.payment_status || "").toUpperCase();
    const mapped =
      status === "SUCCESS" || status === "PAID"
        ? "captured"
        : status === "FAILED" || status === "USER_DROPPED" || status === "CANCELLED"
          ? "failed"
          : status === "PENDING" || status === "NOT_ATTEMPTED"
            ? "authorized"
            : "unknown";
    return {
      providerPaymentId: String(data.cf_payment_id || providerPaymentId),
      providerOrderId: data.order_id,
      status: mapped,
      rawStatus: data.payment_status,
    };
  },

  async createRefund(input: RefundInput, env) {
    this.assertConfigured(env);
    if (!input.providerOrderId) {
      throw new PaymentProviderError("Cashfree refund requires the merchant order_id (providerOrderId).", 400);
    }
    // Cashfree refund_id must be alphanumeric (no UUID hyphens).
    const refundId = input.refundReference.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
    if (!refundId) throw new PaymentProviderError("Invalid refund reference for Cashfree.", 400);

    const response = await fetch(`${cashfreeBaseUrl(env)}/orders/${encodeURIComponent(input.providerOrderId)}/refunds`, {
      method: "POST",
      headers: cashfreeHeaders(env),
      body: JSON.stringify({
        refund_amount: Number((input.amountPaise / 100).toFixed(2)),
        refund_id: refundId,
        refund_note: "VP Loan Connect admin refund",
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      const detail = await readCashfreeError(response);
      throw new PaymentProviderError(`Cashfree refund failed (${response.status}): ${detail}`, 502);
    }
    const data = (await response.json()) as { cf_refund_id?: string | number; refund_id?: string; refund_status?: string };
    const status = String(data.refund_status || "").toUpperCase();
    if (status === "FAILED" || status === "CANCELLED") {
      throw new PaymentProviderError(`Cashfree refund was not accepted (status: ${status || "unknown"}).`, 502);
    }
    return { refundId: String(data.cf_refund_id || data.refund_id || refundId) };
  },
};
