import assert from "node:assert/strict";
import test from "node:test";
import {
  CHECKOUT_LABEL,
  REDIRECT_BLOCKED_MESSAGE,
  REDIRECT_WATCHDOG_MS,
  canStartPayment,
  checkoutButtonLabel,
  shouldRecoverFromBlockedRedirect,
} from "@/lib/payments/checkout-state";

test("first-time buyer sees a single explicit payment call to action", () => {
  assert.equal(checkoutButtonLabel({ busy: false, failed: false, resumable: false }), CHECKOUT_LABEL.start);
  assert.equal(CHECKOUT_LABEL.start, "Proceed to secure payment");
});

test("preparing state replaces the label instead of adding a second loading button", () => {
  assert.equal(checkoutButtonLabel({ busy: true, failed: false, resumable: false }), CHECKOUT_LABEL.preparing);
  assert.equal(checkoutButtonLabel({ busy: true, failed: true, resumable: true }), CHECKOUT_LABEL.preparing);
});

test("a reusable pending order offers resume rather than a new payment", () => {
  assert.equal(checkoutButtonLabel({ busy: false, failed: false, resumable: true }), CHECKOUT_LABEL.resume);
  assert.equal(CHECKOUT_LABEL.resume, "Resume secure payment");
});

test("a failed attempt shows the recoverable retry label", () => {
  assert.equal(checkoutButtonLabel({ busy: false, failed: true, resumable: true }), CHECKOUT_LABEL.retry);
  assert.equal(checkoutButtonLabel({ busy: false, failed: true, resumable: false }), CHECKOUT_LABEL.retry);
  assert.equal(CHECKOUT_LABEL.retry, "Payment not completed — Try again");
});

test("double clicks cannot create a second order", () => {
  assert.equal(canStartPayment({ busy: false, inFlight: false }), true);
  assert.equal(canStartPayment({ busy: true, inFlight: false }), false);
  assert.equal(canStartPayment({ busy: false, inFlight: true }), false);
  assert.equal(canStartPayment({ busy: true, inFlight: true }), false);
});

test("a blocked redirect releases the button instead of spinning forever", () => {
  assert.equal(shouldRecoverFromBlockedRedirect({ leaving: false, visibility: "visible" }), true);
});

test("a real navigation to the hosted page is never treated as a failure", () => {
  assert.equal(shouldRecoverFromBlockedRedirect({ leaving: true, visibility: "visible" }), false);
  assert.equal(shouldRecoverFromBlockedRedirect({ leaving: true, visibility: "hidden" }), false);
  assert.equal(shouldRecoverFromBlockedRedirect({ leaving: false, visibility: "hidden" }), false);
});

test("the recovery message tells the user their order is safe and reusable", () => {
  assert.match(REDIRECT_BLOCKED_MESSAGE, /Resume secure payment/);
  assert.match(REDIRECT_BLOCKED_MESSAGE, /safe/i);
});

test("the redirect watchdog is long enough for a slow network but not indefinite", () => {
  assert.ok(REDIRECT_WATCHDOG_MS >= 8_000, "must tolerate slow mobile networks");
  assert.ok(REDIRECT_WATCHDOG_MS <= 20_000, "must never leave the user staring at a spinner");
});
