import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHmac } from "node:crypto";
import { verifyRazorpayPaymentSignature, verifyRazorpayWebhookSignature } from "./razorpay";

describe("Razorpay signature verification", () => {
  it("accepts only the correct payment signature", () => { const secret = "test-secret"; const signature = createHmac("sha256", secret).update("order_1|pay_1").digest("hex"); assert.equal(verifyRazorpayPaymentSignature("order_1", "pay_1", signature, secret), true); assert.equal(verifyRazorpayPaymentSignature("order_1", "pay_2", signature, secret), false); });
  it("verifies the exact raw webhook body", () => { const secret = "webhook-secret"; const body = '{"event":"payment.captured"}'; const signature = createHmac("sha256", secret).update(body).digest("hex"); assert.equal(verifyRazorpayWebhookSignature(body, signature, secret), true); assert.equal(verifyRazorpayWebhookSignature(`${body} `, signature, secret), false); });
});
