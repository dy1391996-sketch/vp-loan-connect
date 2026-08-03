import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCashfreeSdk, isCashfreeCheckoutDescriptor, buildCashfreeReturnUrl } from "@/lib/payments/cashfree-browser";

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

  it("does not export auto-checkout helpers", async () => {
    const mod = await import("@/lib/payments/cashfree-browser");
    assert.equal("autoStartCheckout" in mod, false);
    assert.equal("useAutoCheckout" in mod, false);
  });
});
