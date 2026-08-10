import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCashfreeReturnUrl,
  classifyCashfreeOrderStatus,
  createCashfreeSdk,
  interpretCashfreeCheckoutResult,
  isCashfreeCheckoutDescriptor,
  isCashfreeCheckoutModalOpen,
  isReusableCashfreeOrderStatus,
  isTerminalUnpaidCashfreeOrderStatus,
} from "@/lib/payments/cashfree-browser";

describe("Cashfree browser SDK helpers", () => {
  it("uses functional Cashfree initializer (not new) when available", () => {
    let usedNew = false;
    function Cashfree(this: unknown, options: { mode: "sandbox" | "production" }) {
      if (typeof new.target !== "undefined" && new.target) usedNew = true;
      assert.equal(options.mode, "production");
      return { checkout: async () => ({ redirect: true }) };
    }
    const sdk = createCashfreeSdk(Cashfree as unknown as Parameters<typeof createCashfreeSdk>[0], "production");
    assert.equal(typeof sdk.checkout, "function");
    assert.equal(usedNew, false);
  });

  it("treats redirect result as redirecting, not cancellation", () => {
    assert.deepEqual(interpretCashfreeCheckoutResult({ redirect: true }), { kind: "redirecting" });
    assert.equal(interpretCashfreeCheckoutResult({ redirect: true }).kind !== "error", true);
  });

  it("only marks explicit SDK errors as cancellation when message says so", () => {
    const cancelled = interpretCashfreeCheckoutResult({ error: { message: "User cancelled payment" } });
    assert.equal(cancelled.kind, "error");
    if (cancelled.kind === "error") assert.equal(cancelled.cancelled, true);

    const hardFail = interpretCashfreeCheckoutResult({ error: { message: "Invalid payment session" } });
    assert.equal(hardFail.kind, "error");
    if (hardFail.kind === "error") assert.equal(hardFail.cancelled, false);

    // Generic resolve must NOT become the old “checkout was closed” path
    assert.equal(interpretCashfreeCheckoutResult(undefined).kind, "unknown");
    assert.equal(interpretCashfreeCheckoutResult({}).kind, "unknown");
  });

  it("validates cashfree checkout descriptor and return URL shape", () => {
    assert.equal(
      isCashfreeCheckoutDescriptor({
        mode: "cashfree_checkout",
        paymentSessionId: "session_abc1234567890",
        env: "production",
      }),
      true,
    );
    assert.equal(isCashfreeCheckoutDescriptor({ mode: "razorpay_modal" }), false);

    const returnUrl = buildCashfreeReturnUrl("https://www.vploanconnect.in", "11111111-1111-1111-1111-111111111111");
    assert.match(returnUrl, /\/api\/payments\/return\?/);
    assert.match(returnUrl, /order_id=\{order_id\}/);
    assert.match(returnUrl, /internalOrderId=11111111-1111-1111-1111-111111111111/);
  });

  it("classifies Cashfree order statuses for reuse vs recreate", () => {
    assert.equal(isReusableCashfreeOrderStatus("ACTIVE"), true);
    assert.equal(isReusableCashfreeOrderStatus("PAID"), false);
    assert.equal(isTerminalUnpaidCashfreeOrderStatus("EXPIRED"), true);
    assert.equal(isTerminalUnpaidCashfreeOrderStatus("USER_DROPPED"), true);
    assert.equal(isTerminalUnpaidCashfreeOrderStatus("TERMINATED"), true);
    assert.equal(isTerminalUnpaidCashfreeOrderStatus("ACTIVE"), false);
    assert.equal(classifyCashfreeOrderStatus("PAID"), "paid");
    assert.equal(classifyCashfreeOrderStatus("ACTIVE"), "pending");
    assert.equal(classifyCashfreeOrderStatus("USER_DROPPED"), "failed");
  });

  it("times out Cashfree launch when SDK never resolves and page stays put", async () => {
    const { launchCashfreeCheckoutWithTimeout } = await import("@/lib/payments/cashfree-browser");
    const cashfree = {
      checkout: () => new Promise(() => undefined),
    };
    const started = Date.now();
    const outcome = await launchCashfreeCheckoutWithTimeout(cashfree, { paymentSessionId: "session_test_1234567890" }, 50);
    assert.equal(outcome.kind, "timeout");
    assert.ok(Date.now() - started < 500);
  });

  it("treats SDK redirect resolve as redirecting", async () => {
    const { launchCashfreeCheckoutWithTimeout } = await import("@/lib/payments/cashfree-browser");
    const cashfree = {
      checkout: async () => ({ redirect: true }),
    };
    const outcome = await launchCashfreeCheckoutWithTimeout(cashfree, { paymentSessionId: "session_test_1234567890" }, 1000);
    assert.equal(outcome.kind, "redirecting");
  });

  it("uses top-level hosted redirect by default", async () => {
    const { launchCashfreeCheckoutWithTimeout } = await import("@/lib/payments/cashfree-browser");
    let redirectTarget = "";
    const cashfree = {
      checkout: async (options: { redirectTarget?: string }) => {
        redirectTarget = options.redirectTarget || "";
        return { redirect: true };
      },
    };
    const outcome = await launchCashfreeCheckoutWithTimeout(cashfree, { paymentSessionId: "session_test_1234567890" }, 1000);
    assert.equal(outcome.kind, "redirecting");
    assert.equal(redirectTarget, "_top");
  });

  it("detects Cashfree modal iframe as open checkout", () => {
    const doc = {
      querySelectorAll: () => [
        {
          offsetWidth: 510,
          offsetHeight: 720,
          getAttribute: (key: string) =>
            key === "name" ? Buffer.from(JSON.stringify({ parentName: "cashfree-modal-iframe" })).toString("base64") : "",
        },
      ],
    } as unknown as Document;
    assert.equal(isCashfreeCheckoutModalOpen(doc), true);
  });

  it("ignores Cashfree ping/telemetry iframes that are not checkout-sized", () => {
    const doc = {
      querySelectorAll: () => [
        {
          offsetWidth: 0,
          offsetHeight: 0,
          getAttribute: (key: string) => (key === "src" ? "https://sdk.cashfree.com/js/v3/atoms/ping_atom.html" : ""),
        },
        {
          offsetWidth: 120,
          offsetHeight: 120,
          getAttribute: (key: string) => (key === "src" ? "https://sdk.cashfree.com/js/v3/cashfree.js" : ""),
        },
      ],
    } as unknown as Document;
    assert.equal(isCashfreeCheckoutModalOpen(doc), false);
  });

  it("does not export auto-checkout helpers", async () => {
    const mod = await import("@/lib/payments/cashfree-browser");
    assert.equal("autoStartCheckout" in mod, false);
    assert.equal("useAutoCheckout" in mod, false);
  });
});
