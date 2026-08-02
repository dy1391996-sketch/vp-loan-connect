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

function verifyCashfreeWebhookSignature(rawBody: string, timestamp: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(`${timestamp}${rawBody}`).digest("base64");
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function readCashfreeError(response: Response) {
  try {
    const data = (await response.json()) as { message?: string; code?: string };
    return [data.code, data.message].filter(Boolean).join(" — ") || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
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
    const orderAmount = (amountPaise / 100).toFixed(2);
    const orderId = input.notes.internal_order_id || input.receipt;
    const returnUrl = input.returnUrl || `${getPublicAppUrl()}/payment/success?provider=cashfree&order_id={order_id}`;

    const response = await fetch(`${cashfreeBaseUrl(env)}/orders`, {
      method: "POST",
      headers: cashfreeHeaders(env),
      body: JSON.stringify({
        order_id: orderId.slice(0, 45),
        order_amount: Number(orderAmount),
        order_currency: "INR",
        order_note: input.receipt,
        customer_details: {
          customer_id: (input.notes.internal_order_id || orderId).slice(0, 50),
          customer_phone: customerPhone,
          customer_name: input.customer?.name || "VP Loan Connect Customer",
          customer_email: input.customer?.email || "support@vploanconnect.in",
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
      return { ok: false, reason: "Payment order mismatch." };
    }

    const response = await fetch(`${cashfreeBaseUrl(env)}/orders/${encodeURIComponent(providerOrderId)}/payments`, {
      headers: cashfreeHeaders(env),
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, reason: "Unable to confirm Cashfree payment status." };
    }
    const payments = (await response.json()) as Array<{
      cf_payment_id?: string | number;
      payment_status?: string;
      payment_amount?: number;
    }>;
    const success = (Array.isArray(payments) ? payments : []).find((item) =>
      ["SUCCESS", "PAID"].includes(String(item.payment_status || "").toUpperCase()),
    );
    if (!success?.cf_payment_id) {
      return { ok: false, reason: "Cashfree payment is not successful yet." };
    }
    return {
      ok: true,
      providerOrderId,
      providerPaymentId: String(success.cf_payment_id),
    };
  },

  verifyWebhookSignature(rawBody, headers, env) {
    const secret = env.CASHFREE_WEBHOOK_SECRET || env.CASHFREE_SECRET_KEY;
    if (!secret) return false;
    const signature = headers.get("x-webhook-signature") || headers.get("x-cashfree-signature") || "";
    const timestamp = headers.get("x-webhook-timestamp") || headers.get("x-cashfree-timestamp") || "";
    if (!signature || !timestamp) return false;
    return verifyCashfreeWebhookSignature(rawBody, timestamp, signature, secret);
  },

  parseWebhook(rawBody, headers): WebhookParseResult {
    let body: {
      type?: string;
      event_time?: string;
      data?: {
        order?: { order_id?: string };
        payment?: { cf_payment_id?: string | number; payment_status?: string; payment_message?: string };
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
    const providerEventId = headers.get("x-webhook-id") || `${body.type || "cashfree"}:${paymentId || orderId || "na"}`;

    if (orderId && paymentId && (body.type?.includes("SUCCESS") || status === "SUCCESS" || status === "PAID")) {
      return {
        kind: "payment_captured",
        providerEventId,
        providerOrderId: orderId,
        providerPaymentId: String(paymentId),
      };
    }
    if (orderId && (body.type?.includes("FAILED") || status === "FAILED")) {
      return {
        kind: "payment_failed",
        providerEventId,
        providerOrderId: orderId,
        providerPaymentId: paymentId ? String(paymentId) : undefined,
        failureDescription: body.data?.payment?.payment_message,
      };
    }
    return { kind: "ignored", reason: body.type || "unhandled_event" };
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
        : status === "FAILED"
          ? "failed"
          : status === "PENDING"
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
    const response = await fetch(`${cashfreeBaseUrl(env)}/orders/refunds`, {
      method: "POST",
      headers: cashfreeHeaders(env),
      body: JSON.stringify({
        refund_amount: Number((input.amountPaise / 100).toFixed(2)),
        refund_id: input.refundReference.slice(0, 40),
        refund_note: "VP Loan Connect admin refund",
        payment_id: input.paymentId,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      const detail = await readCashfreeError(response);
      throw new PaymentProviderError(`Cashfree refund failed (${response.status}): ${detail}`, 502);
    }
    const data = (await response.json()) as { cf_refund_id?: string | number; refund_id?: string };
    return { refundId: String(data.cf_refund_id || data.refund_id || input.refundReference) };
  },
};
