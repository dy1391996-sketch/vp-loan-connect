/**
 * Browser-side Cashfree PG Web SDK helpers.
 * Official docs: Cashfree({ mode }) — function call, not `new` constructor.
 */

export type CashfreeCheckoutInstance = {
  checkout: (options: { paymentSessionId: string; redirectTarget?: string }) => Promise<unknown>;
};

export type CashfreeFactory = ((options: { mode: "sandbox" | "production" }) => CashfreeCheckoutInstance) &
  (new (options: { mode: "sandbox" | "production" }) => CashfreeCheckoutInstance);

/** Prefer functional SDK init; fall back to legacy constructor if needed. */
export function createCashfreeSdk(
  Cashfree: CashfreeFactory,
  mode: "sandbox" | "production",
): CashfreeCheckoutInstance {
  try {
    const instance = Cashfree({ mode });
    if (instance && typeof instance.checkout === "function") return instance;
  } catch {
    /* fall through to constructor */
  }
  return new Cashfree({ mode });
}

export function isCashfreeCheckoutDescriptor(value: unknown): value is {
  mode: "cashfree_checkout";
  paymentSessionId: string;
  env: "sandbox" | "production";
} {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.mode === "cashfree_checkout" &&
    typeof record.paymentSessionId === "string" &&
    record.paymentSessionId.length > 10 &&
    (record.env === "sandbox" || record.env === "production")
  );
}

export function buildCashfreeReturnUrl(appUrl: string, internalOrderId: string): string {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/api/payments/return?order_id={order_id}&internalOrderId=${internalOrderId}`;
}
