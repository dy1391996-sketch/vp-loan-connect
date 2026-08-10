/**
 * Cashfree hosted checkout — server-driven full-page redirect.
 *
 * The browser is sent to Cashfree's hosted checkout page with a top-level form POST
 * carrying `payment_session_id`. This is the same entry point and field the official
 * Cashfree PG Web SDK v3 uses for redirect checkout, but applied on every device.
 *
 * The SDK is deliberately not used: it only performs the redirect when the viewport is
 * at least 768px wide, and otherwise mounts an embedded iframe whose promise can stay
 * unresolved, which is what left the checkout button spinning indefinitely.
 *
 * The target origin must also be present in the site's CSP `form-action` directive,
 * otherwise the browser blocks the submission silently.
 */

export type CashfreeMode = "sandbox" | "production";

export const CASHFREE_HOSTED_CHECKOUT_URL: Record<CashfreeMode, string> = {
  production: "https://api.cashfree.com/pg/view/sessions/checkout",
  sandbox: "https://sandbox.cashfree.com/pg/view/sessions/checkout",
};

/** Origins that must be allowed by CSP `form-action` for hosted checkout to load. */
export const CASHFREE_CHECKOUT_FORM_ACTION_ORIGINS = [
  "https://api.cashfree.com",
  "https://sandbox.cashfree.com",
  "https://payments.cashfree.com",
  "https://payments-test.cashfree.com",
] as const;

export type CashfreeHostedCheckout = {
  mode: "cashfree_hosted";
  actionUrl: string;
  fields: Record<string, string>;
  env: CashfreeMode;
};

export function buildCashfreeHostedCheckout(input: {
  paymentSessionId: string;
  env: CashfreeMode;
  requestId?: string;
}): CashfreeHostedCheckout {
  const paymentSessionId = input.paymentSessionId.trim();
  if (!paymentSessionId) throw new Error("Cashfree payment_session_id is required for hosted checkout.");
  const fields: Record<string, string> = { payment_session_id: paymentSessionId };
  if (input.requestId) fields.x_request_id = input.requestId.slice(0, 64);
  return {
    mode: "cashfree_hosted",
    actionUrl: CASHFREE_HOSTED_CHECKOUT_URL[input.env],
    fields,
    env: input.env,
  };
}

export function isCashfreeHostedCheckoutDescriptor(value: unknown): value is CashfreeHostedCheckout {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (record.mode !== "cashfree_hosted") return false;
  if (record.env !== "sandbox" && record.env !== "production") return false;
  if (typeof record.actionUrl !== "string") return false;
  if (record.actionUrl !== CASHFREE_HOSTED_CHECKOUT_URL[record.env]) return false;
  const fields = record.fields;
  if (!fields || typeof fields !== "object") return false;
  const sessionId = (fields as Record<string, unknown>).payment_session_id;
  return typeof sessionId === "string" && sessionId.length > 10;
}

export function buildCashfreeReturnUrl(appUrl: string, internalOrderId: string): string {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/api/payments/return?order_id={order_id}&internalOrderId=${internalOrderId}`;
}

/** Cashfree order statuses that can be reused for another checkout attempt. */
export function isReusableCashfreeOrderStatus(status: string | undefined | null): boolean {
  const normalized = String(status || "").toUpperCase();
  return normalized === "ACTIVE" || normalized === "PENDING" || normalized === "" || normalized === "NOT_ATTEMPTED";
}

/** Terminal unpaid statuses — must create a fresh order. */
export function isTerminalUnpaidCashfreeOrderStatus(status: string | undefined | null): boolean {
  const normalized = String(status || "").toUpperCase();
  return ["FAILED", "EXPIRED", "TERMINATED", "USER_DROPPED", "CANCELLED"].includes(normalized);
}

export function classifyCashfreeOrderStatus(status: string | undefined | null): "paid" | "pending" | "failed" | "unknown" {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "PAID") return "paid";
  if (isReusableCashfreeOrderStatus(normalized)) return "pending";
  if (isTerminalUnpaidCashfreeOrderStatus(normalized)) return "failed";
  return "unknown";
}
