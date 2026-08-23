import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assessmentSchema } from "./assessment-schema";
import { ageFromDob, evaluateIncomeLoanConsistency } from "./cross-field-rules";
import { isIndividualPan, isValidPanFormat, maskPan, normalizePan, panFormatStatus } from "./identity";
import { isDisposableEmailDomain, isImpossibleMobile, looksLikeFakePersonName, looksLikeWeakAddress } from "./risk-signals";
import { assertFormatOnlyNeverClaimsVerified, getPanProvider } from "@/lib/providers/pan";

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

describe("PAN identity helpers", () => {
  it("accepts valid individual PAN format", () => {
    assert.equal(isValidPanFormat("abcpt1234f"), true);
    assert.equal(normalizePan("abc pt1234f"), "ABCPT1234F");
    assert.equal(isIndividualPan("ABCPT1234F"), true);
    assert.equal(isIndividualPan("ABCDE1234F"), false);
    assert.equal(panFormatStatus("ABCPT1234F"), "format_valid");
  });

  it("rejects invalid PAN lengths and characters", () => {
    assert.equal(isValidPanFormat("ABCD1234F"), false);
    assert.equal(isValidPanFormat("ABCDE12345"), false);
    assert.equal(isValidPanFormat("ABCDE12E4F"), false);
    assert.equal(panFormatStatus("TEST"), "invalid_format");
  });

  it("masks PAN for UI/logs", () => {
    assert.equal(maskPan("ABCPT1234F"), "ABCPT****F");
  });

  it("format-only provider never claims authorised verification", () => {
    const result = getPanProvider().checkFormat("ABCPT1234F");
    assert.equal(result.formatStatus, "format_valid");
    assert.equal(result.verificationStatus, "not_verified");
    assert.match(result.message, /identity verification pending/i);
    assert.doesNotThrow(() => assertFormatOnlyNeverClaimsVerified(result));
  });
});

describe("risk signals", () => {
  it("detects dummy names and weak addresses", () => {
    assert.equal(looksLikeFakePersonName("test"), true);
    assert.equal(looksLikeFakePersonName("Rahul Sharma"), false);
    assert.equal(looksLikeWeakAddress("abc"), true);
    assert.equal(looksLikeWeakAddress("Flat 12, Green Park, Sector 62"), false);
  });

  it("flags impossible mobiles and disposable emails", () => {
    assert.equal(isImpossibleMobile("9876543210"), true);
    assert.equal(isImpossibleMobile("9876512345"), false);
    assert.equal(isDisposableEmailDomain("a@mailinator.com"), true);
    assert.equal(isDisposableEmailDomain("a@gmail.com"), false);
  });
});

describe("cross-field intelligence", () => {
  it("rejects EMI above income and future/underage DOB", () => {
    const issues = evaluateIncomeLoanConsistency({
      monthlyIncomeRange: "15000_24999",
      existingEmi: 50000,
      loanAmount: 100000,
      durationMonths: 12,
      employmentType: "SALARIED",
      dateOfBirth: "2015-01-01",
    });
    assert.ok(issues.some((i) => i.path === "existingEmi"));
    assert.ok(issues.some((i) => i.path === "dateOfBirth"));
  });

  it("parses age from DOB on server-style calendar math", () => {
    assert.equal(ageFromDob("2099-01-01"), null);
    assert.ok((ageFromDob("1990-01-01") ?? 0) >= 21);
  });
});

describe("assessmentSchema server validation", () => {
  it("accepts a consistent honest payload", () => {
    const parsed = assessmentSchema.safeParse(validPayload());
    assert.equal(parsed.success, true);
  });

  it("rejects invalid PAN even when other fields look filled", () => {
    const parsed = assessmentSchema.safeParse(validPayload({ panNumber: "INVALID" }));
    assert.equal(parsed.success, false);
  });

  it("rejects company PAN for personal profile", () => {
    // 4th character C = company
    const company = assessmentSchema.safeParse(validPayload({ panNumber: "ABCCD1234F" }));
    assert.equal(company.success, false);
  });

  it("rejects client claim of authorised PAN verification", () => {
    const parsed = assessmentSchema.safeParse(validPayload({ panVerificationStatus: "verified_authorised_provider" }));
    assert.equal(parsed.success, false);
  });

  it("rejects amounts below ₹10,000 or above ₹10,00,000", () => {
    assert.equal(assessmentSchema.safeParse(validPayload({ loanAmount: 5000 })).success, false);
    assert.equal(assessmentSchema.safeParse(validPayload({ loanAmount: 1000001 })).success, false);
    assert.equal(assessmentSchema.safeParse(validPayload({ loanAmount: 10000 })).success, true);
  });

  it("rejects age above 60", () => {
    assert.equal(assessmentSchema.safeParse(validPayload({ dateOfBirth: "1950-01-01" })).success, false);
  });

  it("rejects missing service consent", () => {
    const parsed = assessmentSchema.safeParse(validPayload({ serviceConsent: false }));
    assert.equal(parsed.success, false);
  });

  it("rejects EMI above declared income", () => {
    const parsed = assessmentSchema.safeParse(validPayload({ monthlyIncomeRange: "BELOW_15000", existingEmi: 20000 }));
    assert.equal(parsed.success, false);
  });

  it("rejects dummy name and disposable email", () => {
    assert.equal(assessmentSchema.safeParse(validPayload({ fullName: "test" })).success, false);
    assert.equal(assessmentSchema.safeParse(validPayload({ email: "x@mailinator.com" })).success, false);
  });

  it("rejects weak address and future DOB", () => {
    assert.equal(assessmentSchema.safeParse(validPayload({ residentialAddress: "abc" })).success, false);
    assert.equal(assessmentSchema.safeParse(validPayload({ dateOfBirth: "2099-01-01" })).success, false);
  });

  it("rejects a full assessment without OTP unless a draft result token is supplied", () => {
    const missing = assessmentSchema.safeParse(validPayload({ otpVerificationToken: undefined }));
    assert.equal(missing.success, false);
    const withDraftAccess = assessmentSchema.safeParse(
      validPayload({
        otpVerificationToken: undefined,
        draftAssessmentId: "11111111-1111-4111-8111-111111111111",
        resultToken: "r".repeat(40),
      }),
    );
    assert.equal(withDraftAccess.success, true);
  });

  it("still requires PAN, address and work fields to complete after payment", () => {
    const withoutPan = assessmentSchema.safeParse(
      validPayload({
        draftAssessmentId: "11111111-1111-4111-8111-111111111111",
        resultToken: "r".repeat(40),
        otpVerificationToken: undefined,
        panNumber: "",
      }),
    );
    assert.equal(withoutPan.success, false);
  });
});

describe("draftAssessmentSchema", () => {
  it("accepts OTP-verified identity without loan need, PAN, address or work details", async () => {
    const { draftAssessmentSchema } = await import("./assessment-schema");
    const parsed = draftAssessmentSchema.safeParse({
      otpVerificationToken: "x".repeat(40),
      fullName: "Rahul Sharma",
      mobile: "9876512345",
      email: "rahul.sharma@gmail.com",
    });
    assert.equal(parsed.success, true);
    assert.equal(draftAssessmentSchema.safeParse({ ...parsed.data, panNumber: "ABCPT1234F" }).success, true);
    const missingOtp = draftAssessmentSchema.safeParse({
      fullName: "Rahul Sharma",
      mobile: "9876512345",
      email: "rahul.sharma@gmail.com",
    });
    assert.equal(missingOtp.success, false);
  });
});
