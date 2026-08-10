import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCashfreeLaunchPath,
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

    const launchPath = buildCashfreeLaunchPath("11111111-1111-1111-1111-111111111111", "result_token_example_abcdefghijklmnopqrstuvwxyz");
    assert.match(launchPath, /^\/payment\/launch\?/);
    assert.match(launchPath, /internalOrderId=11111111-1111-1111-1111-111111111111/);
    assert.match(launchPath, /token=result_token/);
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

  it("treats SDK redirect resolve as redirecting when no grace confirmation is requested", async () => {
    const { launchCashfreeCheckoutWithTimeout } = await import("@/lib/payments/cashfree-browser");
    const cashfree = {
      checkout: async () => ({ redirect: true }),
    };
    const outcome = await launchCashfreeCheckoutWithTimeout(cashfree, { paymentSessionId: "session_test_1234567890" }, 1000, 0);
    assert.equal(outcome.kind, "redirecting");
  });

  it("reports redirect_blocked when SDK claims redirect but the page never navigates", async () => {
    const { launchCashfreeCheckoutWithTimeout } = await import("@/lib/payments/cashfree-browser");
    const cashfree = {
      checkout: async () => ({ redirect: true }),
    };
    const started = Date.now();
    const outcome = await launchCashfreeCheckoutWithTimeout(cashfree, { paymentSessionId: "session_test_1234567890" }, 1000, 250);
    assert.equal(outcome.kind, "redirect_blocked");
    assert.ok(Date.now() - started >= 250);
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

  it("treats visible Cashfree modal as successful launch, not timeout", async () => {
    const { launchCashfreeCheckoutWithTimeout } = await import("@/lib/payments/cashfree-browser");
    const originalDocument = globalThis.document;
    const originalMutationObserver = globalThis.MutationObserver;
    const frame = {
      offsetWidth: 510,
      offsetHeight: 720,
      getAttribute: (key: string) => (key === "name" ? "cashfree-modal-iframe" : ""),
    };
    // jsdom-less stub: modal already in DOM when launch starts.
    (globalThis as { document?: unknown }).document = {
      documentElement: {},
      querySelectorAll: () => [frame],
    };
    (globalThis as { MutationObserver?: unknown }).MutationObserver = class {
      observe() {}
      disconnect() {}
    };
    try {
      const cashfree = {
        checkout: () => new Promise(() => undefined),
      };
      const outcome = await launchCashfreeCheckoutWithTimeout(cashfree, { paymentSessionId: "session_test_1234567890" }, 200);
      assert.equal(outcome.kind, "modal_open");
    } finally {
      if (originalDocument === undefined) delete (globalThis as { document?: unknown }).document;
      else (globalThis as { document?: unknown }).document = originalDocument;
      if (originalMutationObserver === undefined) delete (globalThis as { MutationObserver?: unknown }).MutationObserver;
      else (globalThis as { MutationObserver?: unknown }).MutationObserver = originalMutationObserver;
    }
  });

  it("does not export auto-checkout helpers", async () => {
    const mod = await import("@/lib/payments/cashfree-browser");
    assert.equal("autoStartCheckout" in mod, false);
    assert.equal("useAutoCheckout" in mod, false);
  });
});
