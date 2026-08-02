import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MOBILE_OTP_CONSUMED_HASH,
  MOBILE_OTP_MAX_ATTEMPTS,
  MOBILE_OTP_MAX_RESENDS,
  MOBILE_OTP_MESSAGES,
  MOBILE_OTP_RESEND_COOLDOWN_MS,
  compareMobileOtp,
  evaluateMobileOtpResend,
  evaluateMobileOtpVerify,
  generateMobileOtpCode,
  hashMobileOtp,
  parseIndianMobileInput,
} from "./mobile-otp";

describe("parseIndianMobileInput", () => {
  it("accepts 10-digit and +91 formats as E.164", () => {
    assert.equal(parseIndianMobileInput("9876512345"), "+919876512345");
    assert.equal(parseIndianMobileInput("+91 98765 12345"), "+919876512345");
    assert.equal(parseIndianMobileInput("919876512345"), "+919876512345");
  });

  it("rejects invalid, repeated-digit and impossible numbers", () => {
    assert.throws(() => parseIndianMobileInput("12345"), /INVALID_MOBILE/);
    assert.throws(() => parseIndianMobileInput("9876543210"), /INVALID_MOBILE/);
    assert.throws(() => parseIndianMobileInput("9999999999"), /INVALID_MOBILE/);
    assert.throws(() => parseIndianMobileInput("5876512345"), /INVALID_MOBILE/);
  });
});

describe("mobile OTP crypto and state machine", () => {
  it("hashes OTP and accepts only the matching code", async () => {
    const code = "482917";
    const hash = await hashMobileOtp(code);
    assert.notEqual(hash, code);
    assert.equal(await compareMobileOtp(code, hash), true);
    assert.equal(await compareMobileOtp("000000", hash), false);
    assert.equal(await compareMobileOtp(code, MOBILE_OTP_CONSUMED_HASH), false);
  });

  it("accepts a valid OTP record", () => {
    const now = new Date("2026-08-02T12:00:00.000Z");
    const result = evaluateMobileOtpVerify(
      {
        mobile: "+919876512345",
        otpHash: "hash",
        attemptCount: 0,
        resendCount: 0,
        expiresAt: new Date(now.getTime() + 60_000),
        verifiedAt: null,
        lastSentAt: now,
      },
      "+919876512345",
      now,
    );
    assert.deepEqual(result, { ok: true });
  });

  it("rejects expired OTP", () => {
    const now = new Date("2026-08-02T12:00:00.000Z");
    const result = evaluateMobileOtpVerify(
      {
        mobile: "+919876512345",
        otpHash: "hash",
        attemptCount: 0,
        resendCount: 0,
        expiresAt: new Date(now.getTime() - 1),
        verifiedAt: null,
        lastSentAt: now,
      },
      "+919876512345",
      now,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "OTP_EXPIRED");
  });

  it("rejects reused OTP", () => {
    const now = new Date("2026-08-02T12:00:00.000Z");
    const result = evaluateMobileOtpVerify(
      {
        mobile: "+919876512345",
        otpHash: MOBILE_OTP_CONSUMED_HASH,
        attemptCount: 1,
        resendCount: 0,
        expiresAt: new Date(now.getTime() + 60_000),
        verifiedAt: now,
        lastSentAt: now,
      },
      "+919876512345",
      now,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "OTP_ALREADY_USED");
  });

  it("rejects wrong mobile", () => {
    const now = new Date("2026-08-02T12:00:00.000Z");
    const result = evaluateMobileOtpVerify(
      {
        mobile: "+919876512345",
        otpHash: "hash",
        attemptCount: 0,
        resendCount: 0,
        expiresAt: new Date(now.getTime() + 60_000),
        verifiedAt: null,
        lastSentAt: now,
      },
      "+919876512399",
      now,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "MOBILE_MISMATCH");
  });

  it("rejects too many attempts", () => {
    const now = new Date("2026-08-02T12:00:00.000Z");
    const result = evaluateMobileOtpVerify(
      {
        mobile: "+919876512345",
        otpHash: "hash",
        attemptCount: MOBILE_OTP_MAX_ATTEMPTS,
        resendCount: 0,
        expiresAt: new Date(now.getTime() + 60_000),
        verifiedAt: null,
        lastSentAt: now,
      },
      "+919876512345",
      now,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "TOO_MANY_ATTEMPTS");
  });

  it("enforces resend cooldown and max resends", () => {
    const now = new Date("2026-08-02T12:00:00.000Z");
    const base = {
      mobile: "+919876512345",
      otpHash: "hash",
      attemptCount: 0,
      expiresAt: new Date(now.getTime() + 60_000),
      verifiedAt: null as Date | null,
      lastSentAt: now,
    };

    const cooling = evaluateMobileOtpResend({ ...base, resendCount: 0 }, "+919876512345", new Date(now.getTime() + 10_000));
    assert.equal(cooling.ok, false);
    if (!cooling.ok) {
      assert.equal(cooling.code, "RESEND_COOLDOWN");
      assert.ok((cooling.retryAfterSec ?? 0) > 0);
      assert.ok((cooling.retryAfterSec ?? 0) <= MOBILE_OTP_RESEND_COOLDOWN_MS / 1000);
    }

    const afterCooldown = evaluateMobileOtpResend(
      { ...base, resendCount: 1 },
      "+919876512345",
      new Date(now.getTime() + MOBILE_OTP_RESEND_COOLDOWN_MS),
    );
    assert.deepEqual(afterCooldown, { ok: true });

    const maxed = evaluateMobileOtpResend(
      { ...base, resendCount: MOBILE_OTP_MAX_RESENDS },
      "+919876512345",
      new Date(now.getTime() + MOBILE_OTP_RESEND_COOLDOWN_MS),
    );
    assert.equal(maxed.ok, false);
    if (!maxed.ok) assert.equal(maxed.code, "MAX_RESENDS");
  });

  it("uses mock code when provided and random 6-digit otherwise", () => {
    assert.equal(generateMobileOtpCode("654321"), "654321");
    const generated = generateMobileOtpCode();
    assert.match(generated, /^\d{6}$/);
  });

  it("exposes safe user messages without secrets", () => {
    assert.equal(MOBILE_OTP_MESSAGES.INVALID_OTP, "Incorrect OTP. Please try again.");
    assert.equal(MOBILE_OTP_MESSAGES.OTP_EXPIRED, "This OTP has expired. Request a new code.");
    assert.equal(MOBILE_OTP_MESSAGES.RATE_LIMITED, "Too many OTP requests. Please try again later.");
    for (const message of Object.values(MOBILE_OTP_MESSAGES)) {
      assert.equal(/otpHash|bcrypt|NEXTAUTH|secret/i.test(message), false);
    }
  });
});

describe("assessment dual-OTP bypass contract", () => {
  it("requires mobile SMS token field in addition to email OTP token", async () => {
    const { assessmentSchema } = await import("@/lib/domain/assessment-schema");
    const missingMobile = assessmentSchema.safeParse({
      otpVerificationToken: "x".repeat(40),
      fullName: "Rahul Sharma",
      mobile: "9876512345",
      email: "rahul.sharma@gmail.com",
      dateOfBirth: "1995-06-15",
      state: "Uttar Pradesh",
      city: "Noida",
      residentialAddress: "Flat 12, Green Park Society, Sector 62",
      pinCode: "201301",
      residenceType: "RENTED",
      monthsAtAddress: 18,
      loanAmount: 100000,
      loanPurpose: "Other personal need",
      loanType: "PERSONAL",
      employmentType: "SALARIED",
      employerOrBusinessName: "Acme Private Limited",
      officeAddress: "Flat 12, Green Park Society, Sector 62",
      monthlyIncomeRange: "40000_59999",
      annualIncome: 600000,
      durationMonths: 24,
      salaryBankCredit: true,
      itrAvailable: false,
      gstAvailable: false,
      udyamAvailable: false,
      sixMonthBankStatement: false,
      existingEmi: 5000,
      activeLoans: 1,
      cardOutstanding: 0,
      currentOverdue: false,
      settledOrWrittenOff: false,
      creditRange: "UNKNOWN",
      panNumber: "ABCPT1234F",
      panFormatValidated: true,
      panVerificationStatus: "not_verified",
      panAvailable: true,
      aadhaarAvailable: false,
      addressProofAvailable: false,
      incomeProofAvailable: false,
      bankStatementAvailable: false,
      businessRegistrationAvailable: false,
      securedAssetAvailable: false,
      serviceConsent: true,
      marketingConsent: false,
      source: "test",
    });
    assert.equal(missingMobile.success, false);
    if (!missingMobile.success) {
      assert.ok(missingMobile.error.issues.some((issue) => issue.path[0] === "mobileOtpVerificationToken"));
    }
  });
});
