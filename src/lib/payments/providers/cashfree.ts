import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
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

/** Cashfree adapter — import only from server routes / server modules (never from client components). */
export const CASHFREE_API_VERSION_DEFAULT = "2025-01-01";
export const CASHFREE_PG_PRODUCTION_BASE_URL = "https://api.cashfree.com/pg";
export const CASHFREE_PG_SANDBOX_BASE_URL = "https://sandbox.cashfree.com/pg";
export const CASHFREE_CLIENT_ID_HEADER = "x-client-id";
export const CASHFREE_CLIENT_SECRET_HEADER = "x-client-secret";
export const CASHFREE_API_VERSION_HEADER = "x-api-version";

function cashfreeAppId(env: ServerEnv) {
  return env.CASHFREE_APP_ID;
}

function cashfreeSecret(env: ServerEnv) {
  return env.CASHFREE_SECRET_KEY;
}

function cashfreeMissing(env: ServerEnv) {
  const missing: string[] = [];
  if (!cashfreeAppId(env)) missing.push("CASHFREE_APP_ID");
  if (!cashfreeSecret(env)) missing.push("CASHFREE_SECRET_KEY");
  return missing;
}

/** Cashfree Payment Gateway sandbox App IDs are generated with a TEST prefix. */
export function looksLikeCashfreeSandboxAppId(appId: string | undefined) {
  return /^TEST/i.test(String(appId ?? "").trim());
}

/**
 * Select sandbox vs production PG.
 * Unset CASHFREE_ENV used to default to sandbox, which 401s when Production
 * Payment Gateway keys (no TEST prefix) are sent to sandbox.cashfree.com.
 * TEST-prefixed keys always use sandbox; other keys use production unless
 * CASHFREE_ENV is explicitly production (TEST + production is a config error).
 */
export function resolveCashfreeEnv(env: Pick<ServerEnv, "CASHFREE_ENV" | "CASHFREE_APP_ID">): "sandbox" | "production" {
  const explicit = env.CASHFREE_ENV === "production" || env.CASHFREE_ENV === "sandbox" ? env.CASHFREE_ENV : "";
  const appId = String(env.CASHFREE_APP_ID || "").trim();
  const sandboxKey = looksLikeCashfreeSandboxAppId(appId);

  if (explicit === "production") return "production";
  if (explicit === "sandbox") {
    if (appId && !sandboxKey) return "production";
    return "sandbox";
  }
  if (sandboxKey) return "sandbox";
  return appId ? "production" : "sandbox";
}

export function cashfreeBaseUrl(env: Pick<ServerEnv, "CASHFREE_ENV" | "CASHFREE_APP_ID">) {
  return resolveCashfreeEnv(env) === "production" ? CASHFREE_PG_PRODUCTION_BASE_URL : CASHFREE_PG_SANDBOX_BASE_URL;
}

function cashfreeApiVersion(env: ServerEnv) {
  return env.CASHFREE_API_VERSION || CASHFREE_API_VERSION_DEFAULT;
}

/** Non-secret metadata for logs and client-safe error payloads. Never include credential values. */
export function describeCashfreeAuthContext(env: ServerEnv) {
  const mode = resolveCashfreeEnv(env);
  const baseUrl = cashfreeBaseUrl(env);
  return {
    mode,
    hostname: new URL(baseUrl).hostname,
    hasAppId: Boolean(cashfreeAppId(env)),
    hasSecret: Boolean(cashfreeSecret(env)),
    appIdLength: cashfreeAppId(env).length,
    secretLength: cashfreeSecret(env).length,
    apiVersion: cashfreeApiVersion(env),
    vercelEnv: process.env.VERCEL_ENV || "",
  };
}

export function cashfreeAuthRejectedMessage(env: ServerEnv) {
  const context = describeCashfreeAuthContext(env);
  return `Cashfree Payment Gateway rejected the API credentials for ${context.mode} (${context.hostname}). Use Payment Gateway App ID and Secret Key in CASHFREE_APP_ID and CASHFREE_SECRET_KEY (not Payouts or Secure ID), matching CASHFREE_ENV.`;
}

function cashfreeHeaders(env: ServerEnv) {
  return {
    "Content-Type": "application/json",
    [CASHFREE_CLIENT_ID_HEADER]: cashfreeAppId(env),
    [CASHFREE_CLIENT_SECRET_HEADER]: cashfreeSecret(env),
    [CASHFREE_API_VERSION_HEADER]: cashfreeApiVersion(env),
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

const cashfreeOrderSchema = z.object({
  order_id: z.string().min(1),
  cf_order_id: z.union([z.string(), z.number()]).optional(),
  order_amount: z.number().optional(),
  order_currency: z.string().optional(),
  order_status: z.string().optional(),
  payment_session_id: z.string().optional(),
});

export type CashfreeOrderSnapshot = z.infer<typeof cashfreeOrderSchema>;

/** GET /orders/{order_id} — used by return/verify to confirm PAID + amount/currency. */
export async function fetchCashfreeOrder(providerOrderId: string, env: ServerEnv): Promise<CashfreeOrderSnapshot> {
  const response = await fetch(`${cashfreeBaseUrl(env)}/orders/${encodeURIComponent(providerOrderId)}`, {
    headers: cashfreeHeaders(env),
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new PaymentProviderError(`Cashfree order lookup failed (${response.status}): ${await readCashfreeError(response)}`, 502);
  }
  const parsed = cashfreeOrderSchema.safeParse(await response.json());
  if (!parsed.success) throw new PaymentProviderError("Cashfree order response was invalid.", 502);
  return parsed.data;
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
    if (resolveCashfreeEnv(env) === "production" && looksLikeCashfreeSandboxAppId(cashfreeAppId(env))) {
      throw new PaymentProviderError(
        "CASHFREE_APP_ID looks like a Cashfree TEST/sandbox key but CASHFREE_ENV selects production (api.cashfree.com/pg). Use Payment Gateway Production keys from Cashfree → Payment Gateway → Developers → API Keys.",
        503,
      );
    }
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
    // Cashfree allows alphanumeric + underscore + hyphen (UUID is valid).
    const orderId = (input.notes.internal_order_id || input.receipt).slice(0, 45);
    const returnUrl =
      input.returnUrl || `${getPublicAppUrl()}/api/payments/return?order_id={order_id}`;

    const response = await fetch(`${cashfreeBaseUrl(env)}/orders`, {
      method: "POST",
      headers: cashfreeHeaders(env),
      body: JSON.stringify({
        order_id: orderId,
        order_amount: Number(orderAmount),
        order_currency: "INR",
        order_note: input.receipt.slice(0, 200),
        customer_details: {
          customer_id: (input.notes.internal_order_id || orderId).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 50) || orderId.slice(0, 50),
          customer_phone: customerPhone,
          customer_name: input.customer?.name || "VP Loan Connect Customer",
          customer_email: customerEmail,
        },
        order_meta: {
          return_url: returnUrl,
          notify_url: input.notifyUrl,
        },
        order_tags: {
          product: (input.notes.product || "service").slice(0, 50),
          service_type: "report_fee",
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const detail = await readCashfreeError(response);
      const auth = describeCashfreeAuthContext(env);
      console.error("cashfree_order_create_failed", {
        status: response.status,
        detail,
        mode: auth.mode,
        hostname: auth.hostname,
        hasAppId: auth.hasAppId,
        hasSecret: auth.hasSecret,
        appIdLength: auth.appIdLength,
        secretLength: auth.secretLength,
        apiVersion: auth.apiVersion,
        vercelEnv: auth.vercelEnv,
      });
      if (response.status === 401 || response.status === 403) {
        throw new PaymentProviderError(cashfreeAuthRejectedMessage(env), 503);
      }
      throw new PaymentProviderError(`Cashfree order creation failed (${response.status}): ${detail}`, 502);
    }

    const parsed = cashfreeOrderSchema.safeParse(await response.json());
    if (!parsed.success || !parsed.data.payment_session_id || !parsed.data.order_id) {
      throw new PaymentProviderError("Cashfree did not return payment_session_id.", 502);
    }

    return {
      provider: "cashfree" as const,
      providerOrderId: parsed.data.order_id,
      amountPaise,
      currency: "INR" as const,
      checkout: {
        mode: "cashfree_checkout" as const,
        paymentSessionId: parsed.data.payment_session_id,
        env: resolveCashfreeEnv(env),
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

    // Primary invariant source: GET /orders/{order_id}
    let orderSnapshot: CashfreeOrderSnapshot;
    try {
      orderSnapshot = await fetchCashfreeOrder(providerOrderId, env);
    } catch {
      return { ok: false as const, reason: "Unable to confirm Cashfree order status." };
    }

    const orderStatus = String(orderSnapshot.order_status || "").toUpperCase();
    if (orderStatus === "PAID") {
      // continue verification below
    } else if (["ACTIVE", "PENDING", "NOT_ATTEMPTED", ""].includes(orderStatus)) {
      return { ok: false as const, reason: `Cashfree order is not paid yet (${orderStatus || "ACTIVE"}).` };
    } else if (["FAILED", "EXPIRED", "TERMINATED", "USER_DROPPED", "CANCELLED"].includes(orderStatus)) {
      return { ok: false as const, reason: `Cashfree order ended without payment (${orderStatus}).` };
    } else {
      return { ok: false as const, reason: `Cashfree order is not paid yet (${orderStatus || "UNKNOWN"}).` };
    }
    if (orderSnapshot.order_currency && String(orderSnapshot.order_currency).toUpperCase() !== "INR") {
      return { ok: false as const, reason: "Payment currency mismatch." };
    }
    if (!amountsMatchRupees(orderSnapshot.order_amount, payload.expectedAmountPaise)) {
      console.error("cashfree_order_amount_mismatch", {
        orderId: providerOrderId,
        expectedPaise: payload.expectedAmountPaise,
        paid: orderSnapshot.order_amount,
      });
      return { ok: false as const, reason: "Payment amount mismatch." };
    }

    // Resolve cf_payment_id from payment list for local Payment.providerPaymentId uniqueness.
    const paymentsResponse = await fetch(`${cashfreeBaseUrl(env)}/orders/${encodeURIComponent(providerOrderId)}/payments`, {
      headers: cashfreeHeaders(env),
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!paymentsResponse.ok) {
      return { ok: false as const, reason: "Unable to confirm Cashfree payment status." };
    }
    const payments = (await paymentsResponse.json()) as Array<{
      cf_payment_id?: string | number;
      payment_status?: string;
      payment_amount?: number;
      payment_currency?: string;
    }>;
    const success = (Array.isArray(payments) ? payments : []).find((item) =>
      ["SUCCESS", "PAID"].includes(String(item.payment_status || "").toUpperCase()),
    );
    if (!success?.cf_payment_id) {
      // Order is PAID — fall back to deterministic id from cf_order_id if payment list is empty.
      if (orderSnapshot.cf_order_id) {
        return {
          ok: true as const,
          providerOrderId,
          providerPaymentId: `cf_order_${orderSnapshot.cf_order_id}`,
        };
      }
      return { ok: false as const, reason: "Cashfree payment is not successful yet." };
    }
    if (success.payment_currency && String(success.payment_currency).toUpperCase() !== "INR") {
      return { ok: false as const, reason: "Payment currency mismatch." };
    }
    if (!amountsMatchRupees(success.payment_amount, payload.expectedAmountPaise)) {
      return { ok: false as const, reason: "Payment amount mismatch." };
    }
    return {
      ok: true as const,
      providerOrderId,
      providerPaymentId: String(success.cf_payment_id),
    };
  },

  verifyWebhookSignature(rawBody, headers, env) {
    const secret = env.CASHFREE_WEBHOOK_SECRET || cashfreeSecret(env);
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
        refund?: {
          cf_refund_id?: string | number;
          refund_id?: string;
          refund_status?: string;
          refund_amount?: number;
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
    const providerEventId =
      headers.get("x-webhook-id") ||
      headers.get("x-idempotency-key") ||
      `${eventType || "cashfree"}:${body.data?.refund?.cf_refund_id || paymentId || orderId || "na"}`;

    if (orderId && eventType.toUpperCase().includes("REFUND")) {
      const refundStatus = String(body.data?.refund?.refund_status || "").toUpperCase();
      const providerRefundId = String(body.data?.refund?.cf_refund_id || body.data?.refund?.refund_id || "");
      if (!providerRefundId) return { kind: "ignored", reason: "refund_missing_id" };
      const mapped =
        refundStatus === "SUCCESS" || refundStatus === "COMPLETED"
          ? "COMPLETED"
          : refundStatus === "FAILED" || refundStatus === "CANCELLED"
            ? "FAILED"
            : "PROCESSING";
      return {
        kind: "refund_update",
        providerEventId,
        providerOrderId: orderId,
        providerRefundId,
        status: mapped,
        amountRupees: body.data?.refund?.refund_amount,
      };
    }

    const successEvent =
      eventType === "PAYMENT_SUCCESS_WEBHOOK" ||
      eventType.includes("PAYMENT_SUCCESS") ||
      status === "SUCCESS" ||
      status === "PAID";
    const failedEvent =
      eventType === "PAYMENT_FAILED_WEBHOOK" ||
      eventType === "PAYMENT_USER_DROPPED_WEBHOOK" ||
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
        failureDescription: body.data?.payment?.payment_message || status || eventType,
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
    const refundId = input.refundReference.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
    if (!refundId) throw new PaymentProviderError("Invalid refund reference for Cashfree.", 400);

    const response = await fetch(`${cashfreeBaseUrl(env)}/orders/${encodeURIComponent(input.providerOrderId)}/refunds`, {
      method: "POST",
      headers: {
        ...cashfreeHeaders(env),
        "x-idempotency-key": refundId,
      },
      body: JSON.stringify({
        refund_amount: Number((input.amountPaise / 100).toFixed(2)),
        refund_id: refundId,
        refund_note: "VP Loan Connect service fee refund",
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
