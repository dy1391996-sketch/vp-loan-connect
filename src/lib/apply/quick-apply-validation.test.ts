import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_LOAN_AMOUNT,
  MIN_LOAN_AMOUNT,
  defaultQuickApplyForm,
  loanTypeFromPurpose,
  mapEmploymentApi,
  mapIncomeToRange,
  maskEmail,
  toPersistedDraft,
} from "./quick-apply-state";
import { validateQuickApplyStep } from "./quick-apply-validation";

function form(overrides: Partial<ReturnType<typeof defaultQuickApplyForm>> = {}) {
  return { ...defaultQuickApplyForm(), ...overrides };
}

describe("quick apply amount and purpose", () => {
  it("requires amount within 10k–10L", () => {
    assert.match(validateQuickApplyStep(1, form({ loanAmount: 5000 })), /10,000/);
    assert.equal(validateQuickApplyStep(1, form({ loanAmount: MIN_LOAN_AMOUNT })), "");
    assert.equal(validateQuickApplyStep(1, form({ loanAmount: MAX_LOAN_AMOUNT })), "");
    assert.match(validateQuickApplyStep(1, form({ loanAmount: MAX_LOAN_AMOUNT + 1 })), /Maximum/);
  });

  it("requires a purpose and maps business loan type", () => {
    assert.match(validateQuickApplyStep(2, form()), /funds for/i);
    assert.equal(validateQuickApplyStep(2, form({ loanPurpose: "Education expense" })), "");
    assert.equal(loanTypeFromPurpose("Business working capital"), "BUSINESS");
    assert.equal(loanTypeFromPurpose("Personal expenses"), "PERSONAL");
  });
});

describe("quick apply profile and employment", () => {
  it("validates profile fields and age 21–60", () => {
    const base = form({
      fullName: "Rahul Sharma",
      email: "rahul@gmail.com",
      mobile: "9876512345",
      dateOfBirth: "1995-06-15",
      pinCode: "201301",
    });
    assert.equal(validateQuickApplyStep(3, base), "");
    assert.match(validateQuickApplyStep(3, form({ ...base, dateOfBirth: "2010-01-01" })), /21 and 60/);
    assert.match(validateQuickApplyStep(3, form({ ...base, pinCode: "123" })), /PIN/);
  });

  it("requires conditional salaried fields", () => {
    const employed = form({
      employmentUi: "SALARIED",
      monthlyIncome: "45000",
      employerOrBusinessName: "Acme Private Limited",
      durationMonths: "24",
    });
    assert.match(validateQuickApplyStep(5, employed), /salary/i);
    assert.equal(
      validateQuickApplyStep(
        5,
        form({
          ...employed,
          salaryCreditMode: "bank",
          salaryDate: "1",
        }),
      ),
      "",
    );
    assert.equal(mapEmploymentApi("PROFESSIONAL"), "FREELANCER");
    assert.equal(mapIncomeToRange(45000), "40000_59999");
  });
});

describe("quick apply consent and draft safety", () => {
  it("keeps service and marketing consent separate and unchecked", () => {
    const consentForm = form({
      serviceConsent: false,
      marketingConsent: false,
    });
    assert.match(validateQuickApplyStep(8, consentForm), /consent/i);
    assert.equal(validateQuickApplyStep(8, form({ serviceConsent: true, marketingConsent: false })), "");
  });

  it("does not persist PAN or OTP tokens in draft", () => {
    const draft = toPersistedDraft(
      7,
      form({ panNumber: "ABCPT1234F", fullName: "Rahul Sharma" }),
      true,
    );
    assert.equal(draft.form.panNumber, "");
    assert.equal(draft.otpVerified, true);
    assert.ok(!JSON.stringify(draft).includes("ABCPT1234F"));
  });

  it("masks email for OTP step", () => {
    assert.match(maskEmail("rahul.sharma@gmail.com"), /\*\*\*/);
  });
});

describe("no SMS OTP contract for quick apply validation helpers", () => {
  it("step 3 never requires SMS OTP fields", () => {
    const payload = form({
      fullName: "Rahul Sharma",
      email: "rahul@gmail.com",
      mobile: "9876512345",
      dateOfBirth: "1995-06-15",
      pinCode: "201301",
    });
    assert.equal(validateQuickApplyStep(3, payload), "");
    assert.equal("smsOtp" in payload, false);
  });
});
