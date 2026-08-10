/**
 * Pure state rules for the checkout button.
 * Kept outside the component so the "never spin forever" and "never double-charge"
 * guarantees are unit tested rather than only observed in a browser.
 */

export const CHECKOUT_LABEL = {
  start: "Proceed to secure payment",
  preparing: "Preparing secure payment…",
  resume: "Resume secure payment",
  retry: "Payment not completed — Try again",
} as const;

export type CheckoutButtonState = {
  busy: boolean;
  failed: boolean;
  resumable: boolean;
};

export function checkoutButtonLabel(state: CheckoutButtonState): string {
  if (state.busy) return CHECKOUT_LABEL.preparing;
  if (state.failed) return CHECKOUT_LABEL.retry;
  if (state.resumable) return CHECKOUT_LABEL.resume;
  return CHECKOUT_LABEL.start;
}

/** A second click while an order request or redirect is in flight must never create another order. */
export function canStartPayment(state: { busy: boolean; inFlight: boolean }): boolean {
  return !state.busy && !state.inFlight;
}

/**
 * After submitting the hosted-checkout form the tab should be navigating away.
 * If it is still here and visible, the redirect was blocked (CSP, extension, offline)
 * and the button must be released with a recoverable message.
 */
export function shouldRecoverFromBlockedRedirect(state: {
  leaving: boolean;
  visibility: "visible" | "hidden" | "prerender";
}): boolean {
  if (state.leaving) return false;
  return state.visibility === "visible";
}

/** How long to wait for the browser to leave for the hosted payment page. */
export const REDIRECT_WATCHDOG_MS = 12_000;

export const REDIRECT_BLOCKED_MESSAGE =
  "The secure payment page could not open. Your payment reference is safe — tap Resume secure payment to try again.";
