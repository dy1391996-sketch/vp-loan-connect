import assert from "node:assert/strict";
import test from "node:test";
import { validateBuildEnvironment, validateProductionEnvironment, validateRuntimeEnvironment } from "./env";

const validEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://vp:secret@db.example.test:5432/vp?sslmode=require",
  NEXT_PUBLIC_APP_URL: "https://vploanconnect.in",
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

test("production runtime does not require unrelated integration credentials", () => {
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

test("production environment rejects mock providers", () => {
  assert.throws(() => validateProductionEnvironment({ ...validEnvironment, OTP_PROVIDER: "mock" }), /OTP_PROVIDER must be custom/);
});

test("production environment rejects incomplete legal identity", () => {
  assert.throws(() => validateProductionEnvironment({ ...validEnvironment, BUSINESS_ADDRESS: "" }), /BUSINESS_ADDRESS/);
});
