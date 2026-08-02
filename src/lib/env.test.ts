import assert from "node:assert/strict";
import test from "node:test";
import {
  getPublicAppUrl,
  normalizePublicAppUrl,
  resetServerEnvCacheForTests,
  resolvePublicAppUrl,
  validateBuildEnvironment,
  validateCriticalProductionEnvironment,
  validateProductionEnvironment,
  validateRuntimeEnvironment,
} from "./env";

const validEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://vp:secret@db.example.test:5432/vp?sslmode=require",
  NEXT_PUBLIC_APP_URL: "https://www.vploanconnect.in",
  NEXTAUTH_SECRET: "n".repeat(48),
  REPORT_SIGNING_SECRET: "r".repeat(48),
  PAYMENT_PROVIDER: "razorpay",
  RAZORPAY_KEY_ID: "rzp_live_test",
  RAZORPAY_KEY_SECRET: "secret",
  RAZORPAY_WEBHOOK_SECRET: "webhook-secret",
  WHATSAPP_PROVIDER: "meta",
  WHATSAPP_API_URL: "https://graph.facebook.com/v22.0",
  WHATSAPP_ACCESS_TOKEN: "access-token",
  WHATSAPP_PHONE_NUMBER_ID: "1234567890",
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: "verify-token",
  WHATSAPP_APP_SECRET: "app-secret",
  OTP_PROVIDER: "custom",
  OTP_API_URL: "https://otp.example.test/send",
  OTP_API_KEY: "otp-secret",
  NEXT_PUBLIC_MSG91_WIDGET_ID: "widget-id",
  NEXT_PUBLIC_MSG91_WIDGET_TOKEN: "widget-token",
  BUSINESS_NAME: "VP Loan Connect",
  BUSINESS_GSTIN: "06ABCDE1234F1Z5",
  BUSINESS_ADDRESS: "Registered business address",
  SUPPORT_EMAIL: "support@vploanconnect.in",
  SUPPORT_WHATSAPP: "+919876543210",
  GRIEVANCE_NAME: "Grievance Officer",
  GRIEVANCE_EMAIL: "grievance@vploanconnect.in",
};

test("production environment accepts only complete official-provider configuration", () => {
  const result = validateProductionEnvironment(validEnvironment);
  assert.equal(result.PAYMENT_PROVIDER, "razorpay");
  assert.equal(result.OTP_PROVIDER, "custom");
  assert.equal(result.WHATSAPP_PROVIDER, "meta");
});

test("build environment does not require credentials for runtime-only integrations", () => {
  const buildEnvironment = {
    NODE_ENV: "production" as const,
    DATABASE_URL: validEnvironment.DATABASE_URL,
    NEXT_PUBLIC_APP_URL: validEnvironment.NEXT_PUBLIC_APP_URL,
    NEXTAUTH_SECRET: validEnvironment.NEXTAUTH_SECRET,
    REPORT_SIGNING_SECRET: validEnvironment.REPORT_SIGNING_SECRET,
    BUSINESS_NAME: validEnvironment.BUSINESS_NAME,
    SUPPORT_EMAIL: validEnvironment.SUPPORT_EMAIL,
    PAYMENT_PROVIDER: validEnvironment.PAYMENT_PROVIDER,
    OTP_PROVIDER: validEnvironment.OTP_PROVIDER,
    WHATSAPP_PROVIDER: validEnvironment.WHATSAPP_PROVIDER,
  };

  assert.equal(validateBuildEnvironment(buildEnvironment).NODE_ENV, "production");
});

test("production runtime without Vercel gate does not require payment credentials", () => {
  const runtimeEnvironment = {
    NODE_ENV: "production" as const,
    DATABASE_URL: validEnvironment.DATABASE_URL,
    NEXT_PUBLIC_APP_URL: validEnvironment.NEXT_PUBLIC_APP_URL,
    NEXTAUTH_SECRET: validEnvironment.NEXTAUTH_SECRET,
    REPORT_SIGNING_SECRET: validEnvironment.REPORT_SIGNING_SECRET,
    BUSINESS_NAME: validEnvironment.BUSINESS_NAME,
    SUPPORT_EMAIL: validEnvironment.SUPPORT_EMAIL,
    PAYMENT_PROVIDER: validEnvironment.PAYMENT_PROVIDER,
    OTP_PROVIDER: validEnvironment.OTP_PROVIDER,
    WHATSAPP_PROVIDER: validEnvironment.WHATSAPP_PROVIDER,
  };

  assert.equal(validateRuntimeEnvironment(runtimeEnvironment).NODE_ENV, "production");
});

test("critical production gate allows Razorpay checkout without webhook secret", () => {
  const result = validateCriticalProductionEnvironment({ ...validEnvironment, RAZORPAY_WEBHOOK_SECRET: "" });
  assert.equal(result.PAYMENT_PROVIDER, "razorpay");
  assert.equal(result.RAZORPAY_WEBHOOK_SECRET, "");
});

test("Vercel production runtime requires live payment and OTP configuration", () => {
  assert.throws(
    () =>
      validateRuntimeEnvironment({
        ...validEnvironment,
        VERCEL_ENV: "production",
        PAYMENT_PROVIDER: "mock",
      }),
    /PAYMENT_PROVIDER must be razorpay/,
  );
  assert.equal(
    validateRuntimeEnvironment({ ...validEnvironment, VERCEL_ENV: "production" }).PAYMENT_PROVIDER,
    "razorpay",
  );
});

test("production environment rejects mock OTP provider", () => {
  assert.throws(() => validateProductionEnvironment({ ...validEnvironment, OTP_PROVIDER: "mock" }), /OTP_PROVIDER must be custom/);
});

test("production environment rejects mock payment provider", () => {
  assert.throws(
    () => validateProductionEnvironment({ ...validEnvironment, PAYMENT_PROVIDER: "mock" }),
    /PAYMENT_PROVIDER must be razorpay, cashfree, phonepe, or payu/,
  );
});

test("production environment requires credentials for the selected payment provider only", () => {
  assert.throws(
    () =>
      validateProductionEnvironment({
        ...validEnvironment,
        PAYMENT_PROVIDER: "cashfree",
        CASHFREE_APP_ID: "",
        CASHFREE_SECRET_KEY: "",
      }),
    /Missing cashfree payment credentials/,
  );
});

test("production environment rejects incomplete legal identity", () => {
  assert.throws(() => validateProductionEnvironment({ ...validEnvironment, BUSINESS_ADDRESS: "" }), /BUSINESS_ADDRESS/);
});

test("normalizePublicAppUrl prefers www canonical origin", () => {
  assert.equal(normalizePublicAppUrl("https://vploanconnect.in"), "https://www.vploanconnect.in");
  assert.equal(normalizePublicAppUrl("https://vploanconnect.in/"), "https://www.vploanconnect.in");
  assert.equal(normalizePublicAppUrl("https://www.vploanconnect.in/path"), "https://www.vploanconnect.in");
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = "https://vploanconnect.in";
  resetServerEnvCacheForTests();
  assert.equal(getPublicAppUrl(), "https://www.vploanconnect.in");
  process.env.NEXT_PUBLIC_APP_URL = previous;
  resetServerEnvCacheForTests();
});

test("resolvePublicAppUrl rejects localhost in production", () => {
  assert.equal(resolvePublicAppUrl("http://localhost:3000", "production"), "https://www.vploanconnect.in");
  assert.equal(resolvePublicAppUrl("https://vploanconnect.in", "production"), "https://www.vploanconnect.in");
  assert.equal(resolvePublicAppUrl("http://localhost:3000", "development"), "http://localhost:3000");
});
