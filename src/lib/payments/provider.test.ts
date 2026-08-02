import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHash, createHmac } from "node:crypto";
import { missingPaymentCredentialKeys, type ServerEnv } from "@/lib/env";
import { listPaymentProviders, mapPaymentError, PaymentConfigurationError } from "@/lib/payments";
import { buildPayuPaymentHash, verifyPayuReverseHash } from "@/lib/payments/providers/payu";
import { verifyRazorpayPaymentSignature, verifyRazorpayWebhookSignature } from "@/lib/payments/providers/razorpay";

function baseEnv(overrides: Partial<ServerEnv> = {}): ServerEnv {
  return {
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://vp:secret@localhost:5432/vp",
    NEXT_PUBLIC_APP_URL: "https://www.vploanconnect.in",
    NEXTAUTH_SECRET: "n".repeat(48),
    REPORT_SIGNING_SECRET: "r".repeat(48),
    PAYMENT_PROVIDER: "razorpay",
    RAZORPAY_KEY_ID: "",
    RAZORPAY_KEY_SECRET: "",
    RAZORPAY_WEBHOOK_SECRET: "",
    CASHFREE_APP_ID: "",
    CASHFREE_SECRET_KEY: "",
    CASHFREE_WEBHOOK_SECRET: "",
    CASHFREE_ENV: "sandbox",
    PHONEPE_MERCHANT_ID: "",
    PHONEPE_SALT_KEY: "",
    PHONEPE_SALT_INDEX: "1",
    PHONEPE_ENV: "sandbox",
    PAYU_KEY: "",
    PAYU_SALT: "",
    PAYU_ENV: "test",
    WHATSAPP_PROVIDER: "mock",
    WHATSAPP_API_URL: "",
    WHATSAPP_ACCESS_TOKEN: "",
    WHATSAPP_PHONE_NUMBER_ID: "",
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: "",
    WHATSAPP_APP_SECRET: "",
    OTP_PROVIDER: "mock",
    OTP_API_URL: "",
    OTP_API_KEY: "",
    MOCK_OTP_CODE: "123456",
    STORE_CONSENT_IP: false,
    BUSINESS_NAME: "VP Loan Connect",
    BUSINESS_GSTIN: "",
    BUSINESS_ADDRESS: "",
    SUPPORT_EMAIL: "support@vploanconnect.in",
    SUPPORT_WHATSAPP: "",
    GRIEVANCE_NAME: "",
    GRIEVANCE_EMAIL: "",
    ANALYTICS_ID: "",
    ...overrides,
  };
}

describe("payment provider registry", () => {
  it("registers mock, razorpay, cashfree, phonepe, and payu", () => {
    const ids = listPaymentProviders().map((provider) => provider.id).sort();
    assert.deepEqual(ids, ["cashfree", "mock", "payu", "phonepe", "razorpay"]);
  });

  it("reports exact missing credentials per provider", () => {
    assert.deepEqual(missingPaymentCredentialKeys(baseEnv({ PAYMENT_PROVIDER: "razorpay" })), [
      "RAZORPAY_KEY_ID",
      "RAZORPAY_KEY_SECRET",
      "RAZORPAY_WEBHOOK_SECRET",
    ]);
    assert.deepEqual(missingPaymentCredentialKeys(baseEnv({ PAYMENT_PROVIDER: "cashfree" })), ["CASHFREE_APP_ID", "CASHFREE_SECRET_KEY"]);
    assert.deepEqual(missingPaymentCredentialKeys(baseEnv({ PAYMENT_PROVIDER: "phonepe" })), [
      "PHONEPE_MERCHANT_ID",
      "PHONEPE_SALT_KEY",
    ]);
    assert.deepEqual(missingPaymentCredentialKeys(baseEnv({ PAYMENT_PROVIDER: "payu" })), ["PAYU_KEY", "PAYU_SALT"]);
    assert.deepEqual(missingPaymentCredentialKeys(baseEnv({ PAYMENT_PROVIDER: "mock" })), []);
  });

  it("maps configuration errors to 503 without faking success", () => {
    const mapped = mapPaymentError(new PaymentConfigurationError("cashfree", ["CASHFREE_APP_ID"]));
    assert.equal(mapped.status, 503);
    assert.match(mapped.error, /CASHFREE_APP_ID/);
    assert.deepEqual(mapped.missing, ["CASHFREE_APP_ID"]);
  });
});

describe("Razorpay signature verification", () => {
  it("accepts only the correct payment signature", () => {
    const secret = "test-secret";
    const signature = createHmac("sha256", secret).update("order_1|pay_1").digest("hex");
    assert.equal(verifyRazorpayPaymentSignature("order_1", "pay_1", signature, secret), true);
    assert.equal(verifyRazorpayPaymentSignature("order_1", "pay_2", signature, secret), false);
  });

  it("verifies the exact raw webhook body", () => {
    const secret = "webhook-secret";
    const body = '{"event":"payment.captured"}';
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    assert.equal(verifyRazorpayWebhookSignature(body, signature, secret), true);
    assert.equal(verifyRazorpayWebhookSignature(`${body} `, signature, secret), false);
  });
});

describe("PayU hash helpers", () => {
  it("builds and verifies reverse hash for success responses", () => {
    const key = "key";
    const salt = "salt";
    const txnid = "txn123";
    const amount = "116.82";
    const productinfo = "VP Loan Connect Credit Profile Booster";
    const firstname = "Rahul";
    const email = "rahul@example.com";
    const paymentHash = buildPayuPaymentHash({ key, txnid, amount, productinfo, firstname, email, salt, udf1: "order-1" });
    assert.match(paymentHash, /^[a-f0-9]{128}$/);

    const reverseHash = createHash("sha512")
      .update([salt, "success", "", "", "", "", "", "", "", "", "", "order-1", email, firstname, productinfo, amount, txnid, key].join("|"))
      .digest("hex");

    const reverseOk = verifyPayuReverseHash({
      status: "success",
      email,
      firstname,
      productinfo,
      amount,
      txnid,
      key,
      salt,
      udf1: "order-1",
      hash: reverseHash,
    });
    assert.equal(reverseOk, true);
    assert.equal(
      verifyPayuReverseHash({
        status: "success",
        email,
        firstname,
        productinfo,
        amount,
        txnid,
        key,
        salt,
        udf1: "order-1",
        hash: "0".repeat(128),
      }),
      false,
    );
  });
});
