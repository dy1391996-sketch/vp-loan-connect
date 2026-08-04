/**
 * Browser-side Cashfree PG Web SDK helpers.
 * Official docs: Cashfree({ mode }) — function call, not `new` constructor.
 * Redirect checkout with redirectTarget "_self" resolves with `{ redirect: true }`
 * while navigation proceeds — that must not be treated as cancellation.
 */

export type CashfreeCheckoutInstance = {
  checkout: (options: { paymentSessionId: string; redirectTarget?: string }) => Promise<unknown>;
};

export type CashfreeFactory = ((options: { mode: "sandbox" | "production" }) => CashfreeCheckoutInstance) &
  (new (options: { mode: "sandbox" | "production" }) => CashfreeCheckoutInstance);

export type CashfreeCheckoutOutcome =
  | { kind: "redirecting" }
  | { kind: "error"; message: string; cancelled: boolean }
  | { kind: "unknown" };

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

export function interpretCashfreeCheckoutResult(result: unknown): CashfreeCheckoutOutcome {
  if (result == null) return { kind: "unknown" };
  if (typeof result !== "object") return { kind: "unknown" };
  const record = result as Record<string, unknown>;

  if (record.error) {
    const error = record.error;
    const message =
      typeof error === "string"
        ? error
        : error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string"
          ? String((error as { message: string }).message)
          : "Cashfree checkout failed.";
    const cancelled = /cancel|closed|dismiss|abort|user.?drop/i.test(message);
    return { kind: "error", message, cancelled };
  }

  // Official redirect checkout resolves with `{ redirect: true }` while leaving the page.
  if (record.redirect === true) return { kind: "redirecting" };

  return { kind: "unknown" };
}

export const CASHFREE_CHECKOUT_LAUNCH_TIMEOUT_MS = 10_000;

export type CashfreeLaunchOutcome =
  | { kind: "navigating" }
  | { kind: "redirecting" }
  | { kind: "error"; message: string; cancelled: boolean }
  | { kind: "timeout" };

/**
 * Start Cashfree redirect checkout with a hard launch timeout.
 * If the page begins unloading, treat that as success (do not show an error).
 * Never await the SDK indefinitely — redirect flows can hang in some browsers.
 */
export async function launchCashfreeCheckoutWithTimeout(
  cashfree: CashfreeCheckoutInstance,
  options: { paymentSessionId: string; redirectTarget?: string },
  timeoutMs = CASHFREE_CHECKOUT_LAUNCH_TIMEOUT_MS,
): Promise<CashfreeLaunchOutcome> {
  let navigated = false;
  const onLeaving = () => {
    navigated = true;
  };
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", onLeaving);
    window.addEventListener("beforeunload", onLeaving);
  }

  try {
    const checkoutPromise = Promise.resolve(
      cashfree.checkout({
        paymentSessionId: options.paymentSessionId,
        redirectTarget: options.redirectTarget ?? "_self",
      }),
    ).then((result) => ({ source: "sdk" as const, result }));

    const timeoutPromise = new Promise<{ source: "timeout" }>((resolve) => {
      setTimeout(() => resolve({ source: "timeout" }), timeoutMs);
    });

    const raced = await Promise.race([checkoutPromise, timeoutPromise]);
    if (navigated) return { kind: "navigating" };
    if (raced.source === "timeout") return { kind: "timeout" };

    const outcome = interpretCashfreeCheckoutResult(raced.result);
    if (navigated || outcome.kind === "redirecting") return { kind: "redirecting" };
    if (outcome.kind === "error") return outcome;
    return { kind: "timeout" };
  } catch (error) {
    if (navigated) return { kind: "navigating" };
    const message = error instanceof Error ? error.message : "Cashfree checkout failed.";
    const cancelled = /cancel|closed|dismiss|abort|user.?drop/i.test(message);
    return { kind: "error", message, cancelled };
  } finally {
    if (typeof window !== "undefined") {
      window.removeEventListener("pagehide", onLeaving);
      window.removeEventListener("beforeunload", onLeaving);
    }
  }
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
  if (isReusableCashfreeOrderStatus(normalized) || normalized === "ACTIVE") return "pending";
  if (isTerminalUnpaidCashfreeOrderStatus(normalized)) return "failed";
  return "unknown";
}
