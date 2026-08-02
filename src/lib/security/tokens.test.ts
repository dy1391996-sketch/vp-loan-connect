import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { SignJWT } from "jose";
import {
  AccessTokenError,
  classifyTokenVerificationError,
  isAccessTokenError,
  signAccessToken,
  verifyAccessToken,
} from "./tokens";
import { assessmentSchema } from "@/lib/domain/assessment-schema";
import { resetServerEnvCacheForTests } from "@/lib/env";
import { errors as JoseErrors } from "jose";

const ORIGINAL_ENV = { ...process.env };

before(() => {
  process.env.NEXTAUTH_SECRET = "test-nextauth-secret-32chars-minimum!!";
  process.env.REPORT_SIGNING_SECRET = "test-report-signing-secret-32chars!!";
  process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/test";
  process.env.NEXT_PUBLIC_APP_URL = "https://www.vploanconnect.in";
  process.env.SUPPORT_EMAIL = "support@vploanconnect.in";
  process.env.BUSINESS_NAME = "VP Loan Connect";
  resetServerEnvCacheForTests();
});

after(() => {
  process.env = { ...ORIGINAL_ENV };
  resetServerEnvCacheForTests();
});

describe("token verification error mapping", () => {
  it("classifies jose and purpose failures without exposing raw details", () => {
    assert.equal(classifyTokenVerificationError(new JoseErrors.JWTExpired("expired", {}, "exp", "check_failed")), "JWT_EXPIRED");
    assert.equal(
      classifyTokenVerificationError(new JoseErrors.JWSSignatureVerificationFailed()),
      "JWS_SIGNATURE_VERIFICATION_FAILED",
    );
    assert.equal(classifyTokenVerificationError(new JoseErrors.JWTInvalid("bad")), "JWT_INVALID");
    assert.equal(
      classifyTokenVerificationError(
        new JoseErrors.JWTClaimValidationFailed("claim check failed", {}, "exp", "required"),
      ),
      "JWT_CLAIM_VALIDATION_FAILED",
    );
    assert.equal(classifyTokenVerificationError(new Error("INVALID_TOKEN_PURPOSE")), "INVALID_TOKEN_PURPOSE");
    assert.equal(classifyTokenVerificationError(new AccessTokenError("MALFORMED_TOKEN")), "MALFORMED_TOKEN");
  });

  it("rejects fake / malformed tokens as AccessTokenError", async () => {
    await assert.rejects(() => verifyAccessToken("not-a-jwt-token-at-all!!!!!!!!!!", "otp_verified"), (error: unknown) => {
      assert.equal(isAccessTokenError(error), true);
      assert.equal((error as AccessTokenError).message, "TOKEN_VERIFICATION_FAILED");
      assert.ok(["MALFORMED_TOKEN", "JWT_INVALID", "JWS_INVALID", "TOKEN_VERIFICATION_FAILED"].includes((error as AccessTokenError).reason));
      return true;
    });
  });

  it("rejects invalid signature", async () => {
    const otherSecret = new TextEncoder().encode("other-secret-key-32-characters-min");
    const forged = await new SignJWT({ purpose: "otp_verified", leadId: "lead-1", email: "a@b.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("+919876512345")
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(otherSecret);

    await assert.rejects(() => verifyAccessToken(forged, "otp_verified"), (error: unknown) => {
      assert.equal(isAccessTokenError(error), true);
      assert.equal((error as AccessTokenError).reason, "JWS_SIGNATURE_VERIFICATION_FAILED");
      return true;
    });
  });

  it("rejects expired tokens", async () => {
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
    const expired = await new SignJWT({ purpose: "otp_verified", leadId: "lead-1", email: "a@b.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("+919876512345")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
      .sign(secret);

    await assert.rejects(() => verifyAccessToken(expired, "otp_verified"), (error: unknown) => {
      assert.equal(isAccessTokenError(error), true);
      assert.equal((error as AccessTokenError).reason, "JWT_EXPIRED");
      return true;
    });
  });

  it("rejects wrong token purpose", async () => {
    const token = await signAccessToken("result_access", "assessment-1", { leadId: "lead-1" }, "10m");
    await assert.rejects(() => verifyAccessToken(token, "otp_verified"), (error: unknown) => {
      assert.equal(isAccessTokenError(error), true);
      assert.equal((error as AccessTokenError).reason, "INVALID_TOKEN_PURPOSE");
      return true;
    });
  });

  it("accepts a valid otp_verified token", async () => {
    const token = await signAccessToken(
      "otp_verified",
      "+919876512345",
      { leadId: "11111111-1111-1111-1111-111111111111", email: "rahul.sharma@gmail.com" },
      "10m",
    );
    const payload = await verifyAccessToken(token, "otp_verified");
    assert.equal(payload.sub, "+919876512345");
    assert.equal(payload.purpose, "otp_verified");
    assert.equal(payload.leadId, "11111111-1111-1111-1111-111111111111");
  });
});

describe("assessment OTP response contract", () => {
  it("keeps schema failures as 400-level validation issues", () => {
    const parsed = assessmentSchema.safeParse({
      otpVerificationToken: "x".repeat(40),
      serviceConsent: false,
    });
    assert.equal(parsed.success, false);
  });

  it("maps AccessTokenError to OTP_VERIFICATION_REQUIRED payload shape", () => {
    const error = new AccessTokenError("JWT_EXPIRED");
    assert.equal(isAccessTokenError(error), true);
    const body = {
      error: "Complete email OTP verification again.",
      code: "OTP_VERIFICATION_REQUIRED",
    };
    assert.equal(body.error.includes("jose"), false);
    assert.equal(body.error.includes("JWT_EXPIRED"), false);
    assert.equal(body.code, "OTP_VERIFICATION_REQUIRED");
  });

  it("does not treat unexpected errors as OTP failures", () => {
    const unexpected = new Error("db_connection_failed");
    assert.equal(isAccessTokenError(unexpected), false);
    assert.equal(classifyTokenVerificationError(unexpected), "TOKEN_VERIFICATION_FAILED");
  });
});
