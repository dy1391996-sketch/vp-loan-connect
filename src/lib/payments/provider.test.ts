import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHash, createHmac } from "node:crypto";
import { missingPaymentCredentialKeys, type ServerEnv } from "@/lib/env";
import { listPaymentProviders, mapPaymentError, PaymentConfigurationError } from "@/lib/payments";
import { cashfreePaymentProvider, verifyCashfreeWebhookSignature } from "@/lib/payments/providers/cashfree";
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
    CASHFREE_API_VERSION: "",
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
    META_CAPI_ACCESS_TOKEN: "",
    META_CAPI_PIXEL_ID: "",
    META_TEST_EVENT_CODE: "",
    META_GRAPH_API_VERSION: "v22.0",
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

describe("Cashfree webhook and verify helpers", () => {
  it("accepts only a matching webhook signature over timestamp+rawBody", () => {
    const secret = "cf-secret";
    const timestamp = String(Date.now());
    const body = JSON.stringify({ type: "PAYMENT_SUCCESS_WEBHOOK", data: { order: { order_id: "ord_1" } } });
    const signature = createHmac("sha256", secret).update(`${timestamp}${body}`).digest("base64");
    assert.equal(verifyCashfreeWebhookSignature(body, timestamp, signature, secret), true);
    assert.equal(verifyCashfreeWebhookSignature(`${body} `, timestamp, signature, secret), false);
    assert.equal(verifyCashfreeWebhookSignature(body, timestamp, "bad", secret), false);
  });

  it("parses success and failed webhook events and ignores pending", () => {
    const success = cashfreePaymentProvider.parseWebhook(
      JSON.stringify({
        type: "PAYMENT_SUCCESS_WEBHOOK",
        data: {
          order: { order_id: "ord_1", order_currency: "INR" },
          payment: { cf_payment_id: "pay_1", payment_status: "SUCCESS", payment_currency: "INR" },
        },
      }),
      new Headers(),
      baseEnv({ PAYMENT_PROVIDER: "cashfree", CASHFREE_APP_ID: "x", CASHFREE_SECRET_KEY: "y", CASHFREE_ENV: "production" }),
    );
    assert.equal(success.kind, "payment_captured");
    if (success.kind === "payment_captured") {
      assert.equal(success.providerOrderId, "ord_1");
      assert.equal(success.providerPaymentId, "pay_1");
    }

    const failed = cashfreePaymentProvider.parseWebhook(
      JSON.stringify({
        type: "PAYMENT_FAILED_WEBHOOK",
        data: {
          order: { order_id: "ord_2" },
          payment: { cf_payment_id: "pay_2", payment_status: "FAILED", payment_message: "Bank declined" },
        },
      }),
      new Headers(),
      baseEnv({ PAYMENT_PROVIDER: "cashfree", CASHFREE_APP_ID: "x", CASHFREE_SECRET_KEY: "y", CASHFREE_ENV: "production" }),
    );
    assert.equal(failed.kind, "payment_failed");

    const ignored = cashfreePaymentProvider.parseWebhook(
      JSON.stringify({ type: "PAYMENT_PENDING_WEBHOOK", data: { order: { order_id: "ord_3" }, payment: { payment_status: "PENDING" } } }),
      new Headers(),
      baseEnv({ PAYMENT_PROVIDER: "cashfree", CASHFREE_APP_ID: "x", CASHFREE_SECRET_KEY: "y", CASHFREE_ENV: "production" }),
    );
    assert.equal(ignored.kind, "ignored");
  });

  it("rejects webhook signatures with stale timestamps", () => {
    const env = baseEnv({ PAYMENT_PROVIDER: "cashfree", CASHFREE_APP_ID: "app", CASHFREE_SECRET_KEY: "secret", CASHFREE_ENV: "production" });
    const body = '{"type":"PAYMENT_SUCCESS_WEBHOOK"}';
    const stale = String(Date.now() - 60 * 60 * 1000);
    const signature = createHmac("sha256", "secret").update(`${stale}${body}`).digest("base64");
    const headers = new Headers({ "x-webhook-timestamp": stale, "x-webhook-signature": signature });
    assert.equal(cashfreePaymentProvider.verifyWebhookSignature(body, headers, env), false);
  });

  it("requires credentials and production env in critical gate messaging path", () => {
    assert.deepEqual(cashfreePaymentProvider.missingCredentials(baseEnv({ PAYMENT_PROVIDER: "cashfree" })), [
      "CASHFREE_APP_ID",
      "CASHFREE_SECRET_KEY",
    ]);
    assert.throws(
      () => cashfreePaymentProvider.assertConfigured(baseEnv({ PAYMENT_PROVIDER: "cashfree" })),
      /CASHFREE_APP_ID/,
    );
  });

  it("creates Cashfree orders with API 2025-01-01 headers, INR amount, and {order_id} return URL", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return new Response(
        JSON.stringify({
          order_id: "cf-order-1",
          payment_session_id: "session_abc",
          order_status: "ACTIVE",
          order_amount: 116.82,
          order_currency: "INR",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    try {
      const result = await cashfreePaymentProvider.createOrder(
        {
          amountPaise: 11682,
          receipt: "VPLC-ORD-TEST",
          notes: { internal_order_id: "11111111-1111-1111-1111-111111111111", product: "credit-health-action-plan" },
          customer: { name: "Rahul", email: "rahul@example.com", mobile: "9876543210" },
          returnUrl: "https://www.vploanconnect.in/api/payments/return?order_id={order_id}&internalOrderId=11111111-1111-1111-1111-111111111111",
          notifyUrl: "https://www.vploanconnect.in/api/webhooks/payments/cashfree",
        },
        baseEnv({
          PAYMENT_PROVIDER: "cashfree",
          CASHFREE_APP_ID: "test_app",
          CASHFREE_SECRET_KEY: "test_secret",
          CASHFREE_ENV: "sandbox",
          CASHFREE_API_VERSION: "2025-01-01",
        }),
      );

      assert.equal(result.provider, "cashfree");
      assert.equal(result.checkout.mode, "cashfree_checkout");
      if (result.checkout.mode === "cashfree_checkout") {
        assert.equal(result.checkout.paymentSessionId, "session_abc");
        assert.equal(result.checkout.env, "sandbox");
      }
      assert.equal(calls.length, 1);
      assert.match(calls[0]!.url, /sandbox\.cashfree\.com\/pg\/orders$/);
      const headers = new Headers(calls[0]!.init?.headers);
      assert.equal(headers.get("x-client-id"), "test_app");
      assert.equal(headers.get("x-client-secret"), "test_secret");
      assert.equal(headers.get("x-api-version"), "2025-01-01");
      assert.equal(headers.get("x-idempotency-key"), "11111111-1111-1111-1111-111111111111");
      assert.equal(headers.get("x-request-id"), "11111111-1111-1111-1111-111111111111");
      const body = JSON.parse(String(calls[0]!.init?.body)) as {
        order_amount: number;
        order_currency: string;
        order_expiry_time: string;
        order_meta: { return_url: string };
      };
      assert.equal(body.order_amount, 116.82);
      assert.equal(body.order_currency, "INR");
      assert.ok(Date.parse(body.order_expiry_time) > Date.now());
      assert.match(body.order_meta.return_url, /order_id=\{order_id\}/);
      assert.doesNotMatch(JSON.stringify(result), /test_secret|CASHFREE_SECRET/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects verify when Cashfree order amount or currency mismatches", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/orders/") && !url.includes("/payments")) {
        return new Response(
          JSON.stringify({
            order_id: "ord_1",
            order_status: "PAID",
            order_amount: 999.0,
            order_currency: "INR",
            cf_order_id: 1,
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }) as typeof fetch;

    try {
      const env = baseEnv({
        PAYMENT_PROVIDER: "cashfree",
        CASHFREE_APP_ID: "app",
        CASHFREE_SECRET_KEY: "secret",
        CASHFREE_ENV: "sandbox",
      });
      const amountMismatch = await cashfreePaymentProvider.verifyClientPayment(
        { internalOrderId: "x", providerOrderId: "ord_1", expectedAmountPaise: 11682, raw: { order_id: "ord_1" } },
        "ord_1",
        env,
      );
      assert.equal(amountMismatch.ok, false);
      if (!amountMismatch.ok) assert.match(amountMismatch.reason, /amount mismatch/i);
    } finally {
      globalThis.fetch = originalFetch;
    }

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          order_id: "ord_1",
          order_status: "PAID",
          order_amount: 116.82,
          order_currency: "USD",
          cf_order_id: 1,
        }),
        { status: 200 },
      )) as typeof fetch;
    try {
      const env = baseEnv({
        PAYMENT_PROVIDER: "cashfree",
        CASHFREE_APP_ID: "app",
        CASHFREE_SECRET_KEY: "secret",
        CASHFREE_ENV: "sandbox",
      });
      const currencyMismatch = await cashfreePaymentProvider.verifyClientPayment(
        { internalOrderId: "x", providerOrderId: "ord_1", expectedAmountPaise: 11682, raw: { order_id: "ord_1" } },
        "ord_1",
        env,
      );
      assert.equal(currencyMismatch.ok, false);
      if (!currencyMismatch.ok) assert.match(currencyMismatch.reason, /currency mismatch/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("does not finalize unpaid Cashfree orders on verify", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          order_id: "ord_pending",
          order_status: "ACTIVE",
          order_amount: 116.82,
          order_currency: "INR",
        }),
        { status: 200 },
      )) as typeof fetch;
    try {
      const verified = await cashfreePaymentProvider.verifyClientPayment(
        {
          internalOrderId: "x",
          providerOrderId: "ord_pending",
          expectedAmountPaise: 11682,
          raw: { order_id: "ord_pending" },
        },
        "ord_pending",
        baseEnv({ PAYMENT_PROVIDER: "cashfree", CASHFREE_APP_ID: "a", CASHFREE_SECRET_KEY: "b", CASHFREE_ENV: "sandbox" }),
      );
      assert.equal(verified.ok, false);
      if (!verified.ok) assert.match(verified.reason, /not paid yet/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects unpaid currency on success webhook payloads", () => {
    const ignored = cashfreePaymentProvider.parseWebhook(
      JSON.stringify({
        type: "PAYMENT_SUCCESS_WEBHOOK",
        data: {
          order: { order_id: "ord_fx", order_currency: "USD" },
          payment: { cf_payment_id: "pay_fx", payment_status: "SUCCESS", payment_currency: "USD" },
        },
      }),
      new Headers(),
      baseEnv({ PAYMENT_PROVIDER: "cashfree", CASHFREE_APP_ID: "x", CASHFREE_SECRET_KEY: "y", CASHFREE_ENV: "production" }),
    );
    assert.equal(ignored.kind, "ignored");
  });

  it("uses original providerOrderId path for Cashfree refunds", async () => {
    const calls: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ cf_refund_id: "rf_1", refund_status: "PENDING" }), { status: 200 });
    }) as typeof fetch;
    try {
      const refund = await cashfreePaymentProvider.createRefund(
        {
          paymentId: "pay_1",
          providerOrderId: "merchant_order_99",
          amountPaise: 11682,
          refundReference: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        },
        baseEnv({ PAYMENT_PROVIDER: "cashfree", CASHFREE_APP_ID: "a", CASHFREE_SECRET_KEY: "b", CASHFREE_ENV: "sandbox" }),
      );
      assert.equal(refund.refundId, "rf_1");
      assert.match(calls[0]!, /\/orders\/merchant_order_99\/refunds$/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
