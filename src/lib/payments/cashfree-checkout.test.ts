import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  CASHFREE_CHECKOUT_FORM_ACTION_ORIGINS,
  CASHFREE_HOSTED_CHECKOUT_URL,
  buildCashfreeHostedCheckout,
  buildCashfreeReturnUrl,
  classifyCashfreeOrderStatus,
  isCashfreeHostedCheckoutDescriptor,
  isReusableCashfreeOrderStatus,
  isTerminalUnpaidCashfreeOrderStatus,
} from "@/lib/payments/cashfree-checkout";

const SESSION = "session_abcdefghijklmnopqrstuvwxyz0123456789";

test("hosted checkout posts the payment session to the production Cashfree page", () => {
  const checkout = buildCashfreeHostedCheckout({ paymentSessionId: SESSION, env: "production" });
  assert.equal(checkout.mode, "cashfree_hosted");
  assert.equal(checkout.actionUrl, "https://api.cashfree.com/pg/view/sessions/checkout");
  assert.equal(checkout.fields.payment_session_id, SESSION);
  assert.equal(checkout.env, "production");
});

test("sandbox mode never points at the production checkout host", () => {
  const checkout = buildCashfreeHostedCheckout({ paymentSessionId: SESSION, env: "sandbox" });
  assert.equal(checkout.actionUrl, "https://sandbox.cashfree.com/pg/view/sessions/checkout");
  assert.ok(!checkout.actionUrl.includes("api.cashfree.com"));
});

test("hosted checkout carries the internal order id for provider-side tracing", () => {
  const checkout = buildCashfreeHostedCheckout({
    paymentSessionId: SESSION,
    env: "production",
    requestId: "11111111-1111-1111-1111-111111111111",
  });
  assert.equal(checkout.fields.x_request_id, "11111111-1111-1111-1111-111111111111");
});

test("hosted checkout never carries an amount the browser could tamper with", () => {
  const checkout = buildCashfreeHostedCheckout({ paymentSessionId: SESSION, env: "production" });
  const serialized = JSON.stringify(checkout).toLowerCase();
  assert.ok(!serialized.includes("amount"));
  assert.ok(!serialized.includes("116.82"));
  assert.deepEqual(Object.keys(checkout.fields), ["payment_session_id"]);
});

test("a blank payment session is rejected instead of opening a broken page", () => {
  assert.throws(() => buildCashfreeHostedCheckout({ paymentSessionId: "  ", env: "production" }));
});

test("descriptor guard rejects tampered action URLs", () => {
  const valid = buildCashfreeHostedCheckout({ paymentSessionId: SESSION, env: "production" });
  assert.equal(isCashfreeHostedCheckoutDescriptor(valid), true);
  assert.equal(
    isCashfreeHostedCheckoutDescriptor({ ...valid, actionUrl: "https://evil.example.com/checkout" }),
    false,
  );
  assert.equal(isCashfreeHostedCheckoutDescriptor({ ...valid, env: "sandbox" }), false);
  assert.equal(isCashfreeHostedCheckoutDescriptor({ ...valid, fields: {} }), false);
  assert.equal(isCashfreeHostedCheckoutDescriptor(null), false);
});

test("every hosted checkout host is CSP form-action allowed", () => {
  for (const url of Object.values(CASHFREE_HOSTED_CHECKOUT_URL)) {
    const origin = new URL(url).origin;
    assert.ok(
      (CASHFREE_CHECKOUT_FORM_ACTION_ORIGINS as readonly string[]).includes(origin),
      `${origin} must be listed in CSP form-action or the browser blocks the redirect`,
    );
  }
});

test("return URL keeps both the provider and internal order reference", () => {
  const url = buildCashfreeReturnUrl("https://www.vploanconnect.in/", "order-uuid");
  assert.equal(
    url,
    "https://www.vploanconnect.in/api/payments/return?order_id={order_id}&internalOrderId=order-uuid",
  );
});

test("only ACTIVE-style Cashfree orders may be resumed", () => {
  for (const status of ["ACTIVE", "PENDING", "NOT_ATTEMPTED", ""]) {
    assert.equal(isReusableCashfreeOrderStatus(status), true, status);
    assert.equal(classifyCashfreeOrderStatus(status), "pending", status);
  }
  for (const status of ["FAILED", "EXPIRED", "TERMINATED", "USER_DROPPED", "CANCELLED"]) {
    assert.equal(isTerminalUnpaidCashfreeOrderStatus(status), true, status);
    assert.equal(isReusableCashfreeOrderStatus(status), false, status);
    assert.equal(classifyCashfreeOrderStatus(status), "failed", status);
  }
  assert.equal(classifyCashfreeOrderStatus("PAID"), "paid");
  assert.equal(classifyCashfreeOrderStatus("SOMETHING_NEW"), "unknown");
});

test("a PAID order is never classified as resumable or terminal-unpaid", () => {
  assert.equal(isReusableCashfreeOrderStatus("PAID"), false);
  assert.equal(isTerminalUnpaidCashfreeOrderStatus("PAID"), false);
});

test("the browser SDK launcher is no longer part of the checkout surface", () => {
  const paymentsDir = new URL(".", import.meta.url);
  const files = readdirSync(paymentsDir);
  assert.ok(!files.includes("cashfree-browser.ts"), "the SDK launch helper must stay deleted");

  const checkoutClient = readFileSync(
    new URL("../../components/checkout/checkout-client.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(!checkoutClient.includes("sdk.cashfree.com"), "checkout must not load the Cashfree JS SDK");
  assert.ok(!checkoutClient.includes("window.Cashfree"), "checkout must not depend on the Cashfree SDK global");
  assert.ok(checkoutClient.includes("cashfree_hosted"), "checkout must handle the hosted redirect descriptor");
});
