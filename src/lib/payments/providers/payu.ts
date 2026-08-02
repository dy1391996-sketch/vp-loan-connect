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

function payuMissing(env: ServerEnv) {
  const missing: string[] = [];
  if (!env.PAYU_KEY) missing.push("PAYU_KEY");
  if (!env.PAYU_SALT) missing.push("PAYU_SALT");
  return missing;
}

function payuBaseUrl(env: ServerEnv) {
  return env.PAYU_ENV === "production" ? "https://secure.payu.in" : "https://test.payu.in";
}

function payuHash(parts: string[]) {
  return createHash("sha512").update(parts.join("|")).digest("hex");
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

export function buildPayuPaymentHash(input: {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  salt: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
}) {
  return payuHash([
    input.key,
    input.txnid,
    input.amount,
    input.productinfo,
    input.firstname,
    input.email,
    input.udf1 || "",
    input.udf2 || "",
    input.udf3 || "",
    input.udf4 || "",
    input.udf5 || "",
    "",
    "",
    "",
    "",
    "",
    input.salt,
  ]);
}

export function verifyPayuReverseHash(input: {
  status: string;
  email: string;
  firstname: string;
  productinfo: string;
  amount: string;
  txnid: string;
  key: string;
  salt: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
  hash: string;
}) {
  const expected = payuHash([
    input.salt,
    input.status,
    "",
    "",
    "",
    "",
    "",
    input.udf5 || "",
    input.udf4 || "",
    input.udf3 || "",
    input.udf2 || "",
    input.udf1 || "",
    input.email,
    input.firstname,
    input.productinfo,
    input.amount,
    input.txnid,
    input.key,
  ]);
  return safeEqualHex(expected.toLowerCase(), input.hash.toLowerCase());
}

export const payuPaymentProvider: PaymentProvider = {
  id: "payu",
  displayName: "PayU",

  missingCredentials(env) {
    return payuMissing(env);
  },

  assertConfigured(env) {
    const missing = payuMissing(env);
    if (missing.length) throw new PaymentConfigurationError("payu", missing);
  },

  async createOrder(input: CreateOrderInput, env: ServerEnv) {
    this.assertConfigured(env);
    const amountPaise = Math.round(input.amountPaise);
    if (!Number.isFinite(amountPaise) || amountPaise < 100) {
      throw new PaymentProviderError(`Invalid payment amount (${amountPaise} paise).`, 400);
    }

    const txnid = (input.notes.internal_order_id || input.receipt).replace(/[^a-zA-Z0-9]/g, "").slice(0, 30);
    const amount = (amountPaise / 100).toFixed(2);
    const productinfo = "VP Loan Connect Credit Profile Booster";
    const firstname = (input.customer?.name || "Customer").trim().slice(0, 60) || "Customer";
    const email = input.customer?.email || "support@vploanconnect.in";
    const phone = (input.customer?.mobile || "").replace(/\D/g, "").slice(-10);
    const surl = input.returnUrl || `${getPublicAppUrl()}/api/payments/payu/return`;
    const furl = `${getPublicAppUrl()}/payment/failed?provider=payu`;
    const udf1 = input.notes.internal_order_id || "";

    const hash = buildPayuPaymentHash({
      key: env.PAYU_KEY,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      salt: env.PAYU_SALT,
      udf1,
    });

    return {
      provider: "payu" as const,
      providerOrderId: txnid,
      amountPaise,
      currency: "INR" as const,
      checkout: {
        mode: "payu_hosted" as const,
        actionUrl: `${payuBaseUrl(env)}/_payment`,
        fields: {
          key: env.PAYU_KEY,
          txnid,
          amount,
          productinfo,
          firstname,
          email,
          phone,
          surl,
          furl,
          hash,
          udf1,
          service_provider: "payu_paisa",
        },
      },
    };
  },

  async verifyClientPayment(payload: ClientVerifyPayload, orderProviderOrderId, env) {
    this.assertConfigured(env);
    const raw = payload.raw ?? {};
    const txnid = String(payload.providerOrderId || raw.txnid || "");
    const status = String(raw.status || "");
    const hash = String(payload.signature || raw.hash || "");
    const mihpayid = String(payload.providerPaymentId || raw.mihpayid || "");

    if (!txnid || !orderProviderOrderId || txnid !== orderProviderOrderId) {
      return { ok: false, reason: "Payment order mismatch." };
    }
    if (!hash || !status) return { ok: false, reason: "Invalid PayU payment response." };

    const valid = verifyPayuReverseHash({
      status,
      email: String(raw.email || ""),
      firstname: String(raw.firstname || ""),
      productinfo: String(raw.productinfo || ""),
      amount: String(raw.amount || ""),
      txnid,
      key: env.PAYU_KEY,
      salt: env.PAYU_SALT,
      udf1: String(raw.udf1 || ""),
      udf2: String(raw.udf2 || ""),
      udf3: String(raw.udf3 || ""),
      udf4: String(raw.udf4 || ""),
      udf5: String(raw.udf5 || ""),
      hash,
    });
    if (!valid) return { ok: false, reason: "PayU hash verification failed." };
    if (status.toLowerCase() !== "success") return { ok: false, reason: `PayU payment status is ${status}.` };
    if (!mihpayid) return { ok: false, reason: "PayU payment id missing." };

    return { ok: true, providerOrderId: txnid, providerPaymentId: mihpayid };
  },

  verifyWebhookSignature(rawBody, _headers, env) {
    if (!env.PAYU_SALT || !env.PAYU_KEY) return false;
    try {
      const params = Object.fromEntries(new URLSearchParams(rawBody).entries());
      // Also accept JSON webhooks
      const data = Object.keys(params).length ? params : (JSON.parse(rawBody) as Record<string, string>);
      return verifyPayuReverseHash({
        status: String(data.status || ""),
        email: String(data.email || ""),
        firstname: String(data.firstname || ""),
        productinfo: String(data.productinfo || ""),
        amount: String(data.amount || ""),
        txnid: String(data.txnid || ""),
        key: env.PAYU_KEY,
        salt: env.PAYU_SALT,
        udf1: String(data.udf1 || ""),
        udf2: String(data.udf2 || ""),
        udf3: String(data.udf3 || ""),
        udf4: String(data.udf4 || ""),
        udf5: String(data.udf5 || ""),
        hash: String(data.hash || ""),
      });
    } catch {
      return false;
    }
  },

  parseWebhook(rawBody): WebhookParseResult {
    try {
      let data: Record<string, string>;
      try {
        data = Object.fromEntries(new URLSearchParams(rawBody).entries());
        if (!Object.keys(data).length) data = JSON.parse(rawBody) as Record<string, string>;
      } catch {
        data = JSON.parse(rawBody) as Record<string, string>;
      }
      const txnid = String(data.txnid || "");
      const mihpayid = String(data.mihpayid || "");
      const status = String(data.status || "").toLowerCase();
      const providerEventId = `${txnid}:${mihpayid || "na"}:${status || "event"}`;
      if (txnid && mihpayid && status === "success") {
        return { kind: "payment_captured", providerEventId, providerOrderId: txnid, providerPaymentId: mihpayid };
      }
      if (txnid && (status === "failure" || status === "failed")) {
        return {
          kind: "payment_failed",
          providerEventId,
          providerOrderId: txnid,
          providerPaymentId: mihpayid || undefined,
          failureDescription: String(data.error_Message || data.field9 || status),
        };
      }
      return { kind: "ignored", reason: status || "unhandled_event" };
    } catch {
      return { kind: "ignored", reason: "invalid_payload" };
    }
  },

  async getPaymentStatus(providerPaymentId): Promise<PaymentStatusResult> {
    // PayU verify API varies by account; expose a conservative unknown unless reverse-hash verify already succeeded.
    return { providerPaymentId, status: "unknown", rawStatus: "use_verify_or_webhook" };
  },

  async createRefund(input: RefundInput, env) {
    this.assertConfigured(env);
    if (!input.paymentId) throw new PaymentProviderError("PayU refund requires mihpayid (provider payment id).", 400);
    throw new PaymentProviderError(
      "PayU refund API is prepared but not yet merchant-enabled. Enable cancel_refund API access in PayU and confirm credentials before using admin refunds for PayU.",
      501,
    );
  },
};
