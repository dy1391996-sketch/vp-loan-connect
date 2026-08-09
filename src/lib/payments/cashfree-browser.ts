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
  | { kind: "modal_open" }
  | { kind: "error"; message: string; cancelled: boolean }
  | { kind: "timeout" };

/** Cashfree PG Web SDK often mounts a modal iframe instead of navigating the page. */
export function isCashfreeCheckoutModalOpen(doc: Document = document): boolean {
  return [...doc.querySelectorAll("iframe")].some((frame) => {
    if (frame.offsetWidth < 100 || frame.offsetHeight < 100) return false;
    const name = frame.getAttribute("name") || "";
    if (/cashfree-modal/i.test(name)) return true;
    try {
      if (name && /cashfree-modal/i.test(atob(name))) return true;
    } catch {
      /* ignore non-base64 names */
    }
    const src = frame.getAttribute("src") || "";
    return /cashfree\.com|cashfree\.js/i.test(src);
  });
}

/**
 * Start Cashfree checkout with a hard launch timeout.
 * Register the timeout first, then invoke the SDK on the next macrotask so a
 * hanging/blocking checkout cannot prevent the timeout from being scheduled.
 * Treats a visible Cashfree modal iframe as a successful launch (not a timeout).
 */
export async function launchCashfreeCheckoutWithTimeout(
  cashfree: CashfreeCheckoutInstance,
  options: { paymentSessionId: string; redirectTarget?: string },
  timeoutMs = CASHFREE_CHECKOUT_LAUNCH_TIMEOUT_MS,
): Promise<CashfreeLaunchOutcome> {
  let navigated = false;
  let modalOpen = false;
  const onLeaving = () => {
    navigated = true;
  };
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", onLeaving);
    window.addEventListener("beforeunload", onLeaving);
  }

  let observer: MutationObserver | undefined;
  try {
    let sdkSettled = false;
    let sdkResult: unknown;
    let sdkError: unknown;

    await new Promise<void>((resolve) => {
      const finish = () => resolve();
      const timer =
        typeof window !== "undefined"
          ? window.setTimeout(finish, timeoutMs)
          : setTimeout(finish, timeoutMs);

      const markModalOpen = () => {
        if (typeof document === "undefined" || !isCashfreeCheckoutModalOpen(document)) return;
        modalOpen = true;
        clearTimeout(timer);
        finish();
      };

      if (typeof document !== "undefined" && typeof MutationObserver !== "undefined") {
        observer = new MutationObserver(markModalOpen);
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
        markModalOpen();
      }

      const startCheckout = () => {
        Promise.resolve(
          cashfree.checkout({
            paymentSessionId: options.paymentSessionId,
            redirectTarget: options.redirectTarget ?? "_self",
          }),
        )
          .then((result) => {
            sdkSettled = true;
            sdkResult = result;
            const outcome = interpretCashfreeCheckoutResult(result);
            markModalOpen();
            if (navigated || modalOpen || outcome.kind === "redirecting" || outcome.kind === "error") {
              clearTimeout(timer);
              finish();
            }
          })
          .catch((error) => {
            sdkSettled = true;
            sdkError = error;
            clearTimeout(timer);
            finish();
          });
      };

      // Schedule after the timeout timer so the event loop always has an exit.
      if (typeof window !== "undefined") window.setTimeout(startCheckout, 0);
      else setTimeout(startCheckout, 0);
    });

    if (navigated) return { kind: "navigating" };
    if (modalOpen || (typeof document !== "undefined" && isCashfreeCheckoutModalOpen(document))) {
      return { kind: "modal_open" };
    }
    if (sdkError) {
      const message = sdkError instanceof Error ? sdkError.message : "Cashfree checkout failed.";
      const cancelled = /cancel|closed|dismiss|abort|user.?drop/i.test(message);
      return { kind: "error", message, cancelled };
    }
    if (sdkSettled) {
      const outcome = interpretCashfreeCheckoutResult(sdkResult);
      if (outcome.kind === "redirecting") return { kind: "redirecting" };
      if (outcome.kind === "error") return outcome;
    }
    return { kind: "timeout" };
  } finally {
    observer?.disconnect();
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
