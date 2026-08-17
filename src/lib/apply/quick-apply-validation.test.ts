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
import {
  getNextQuickApplyStep,
  getPreviousQuickApplyStep,
  normalizeEmailInput,
  validateQuickApplyStep,
  validateQuickApplyStepFields,
} from "./quick-apply-validation";

function form(overrides: Partial<ReturnType<typeof defaultQuickApplyForm>> = {}) {
  return { ...defaultQuickApplyForm(), ...overrides };
}

describe("quick apply identity and OTP order", () => {
  it("validates profile fields and age 21–60 on step 1", () => {
    const base = form({
      fullName: "Rahul Sharma",
      email: "rahul@gmail.com",
      mobile: "9876512345",
      dateOfBirth: "1995-06-15",
      pinCode: "201301",
    });
    assert.equal(validateQuickApplyStep(1, base), "");
    assert.match(validateQuickApplyStep(1, form({ ...base, dateOfBirth: "2010-01-01" })), /21 and 60/);
    assert.match(validateQuickApplyStep(1, form({ ...base, pinCode: "123" })), /PIN/);
  });

  it("trims and lowercases email and shows inline email errors", () => {
    assert.equal(normalizeEmailInput("  Rahul@Gmail.com  "), "rahul@gmail.com");
    const errors = validateQuickApplyStepFields(1, form({ email: "not-an-email", fullName: "Rahul Sharma", mobile: "9876512345", dateOfBirth: "1995-06-15", pinCode: "201301" }));
    assert.match(errors.email || "", /valid email/i);
  });

  it("rejects invalid Indian mobile on the existing profile field", () => {
    const errors = validateQuickApplyStepFields(
      1,
      form({
        fullName: "Rahul Sharma",
        email: "rahul@gmail.com",
        mobile: "12345",
        dateOfBirth: "1995-06-15",
        pinCode: "201301",
      }),
    );
    assert.match(errors.mobile || "", /10-digit/);
  });
});

describe("quick apply amount and purpose", () => {
  it("requires amount within 10k–10L and rejects malformed values", () => {
    assert.match(validateQuickApplyStep(3, form({ loanAmount: 0, loanPurpose: "Education expense" })), /valid loan amount/i);
    assert.match(validateQuickApplyStep(3, form({ loanAmount: 5000, loanPurpose: "Education expense" })), /10,000/);
    assert.equal(validateQuickApplyStep(3, form({ loanAmount: MIN_LOAN_AMOUNT, loanPurpose: "Education expense" })), "");
    assert.equal(validateQuickApplyStep(3, form({ loanAmount: MAX_LOAN_AMOUNT, loanPurpose: "Education expense" })), "");
    assert.match(validateQuickApplyStep(3, form({ loanAmount: MAX_LOAN_AMOUNT + 1, loanPurpose: "Education expense" })), /Maximum/);
  });

  it("requires a purpose and maps business loan type", () => {
    assert.match(validateQuickApplyStep(3, form({ loanAmount: 50_000 })), /funds for/i);
    assert.equal(validateQuickApplyStep(3, form({ loanAmount: 50_000, loanPurpose: "Education expense" })), "");
    assert.equal(loanTypeFromPurpose("Business working capital"), "BUSINESS");
    assert.equal(loanTypeFromPurpose("Personal expenses"), "PERSONAL");
  });
});

describe("quick apply work, credit, PAN and consent", () => {
  it("requires conditional salaried fields and credit commitments on step 4", () => {
    const employed = form({
      employmentUi: "SALARIED",
      monthlyIncome: "45000",
      employerOrBusinessName: "Acme Private Limited",
      durationMonths: "24",
    });
    assert.match(validateQuickApplyStep(4, employed), /salary|EMI|loans|outstanding|overdue|CIBIL/i);
    assert.equal(
      validateQuickApplyStep(
        4,
        form({
          ...employed,
          salaryCreditMode: "bank",
          salaryDate: "1",
          existingEmi: "0",
          activeLoans: "0",
          cardOutstanding: "0",
          currentOverdue: false,
          creditRange: "UNKNOWN",
        }),
      ),
      "",
    );
    assert.equal(mapEmploymentApi("PROFESSIONAL"), "FREELANCER");
    assert.equal(mapIncomeToRange(45000), "40000_59999");
  });

  it("validates Indian PAN format and consent on step 5", () => {
    const ready = form({
      panNumber: "ABCPT1234F",
      residentialAddress: "12, Lotus Apartments, Sector 50",
      city: "Noida",
      state: "Uttar Pradesh",
      addressPinCode: "201301",
      residenceType: "RENTED",
      yearsAtAddress: "2",
      serviceConsent: true,
    });
    assert.equal(validateQuickApplyStep(5, ready), "");
    const panErrors = validateQuickApplyStepFields(5, form({ ...ready, panNumber: "ABCDE12" }));
    assert.match(panErrors.panNumber || "", /10-character PAN/);
    const companyPan = validateQuickApplyStepFields(5, form({ ...ready, panNumber: "ABCCD1234F" }));
    assert.match(companyPan.panNumber || "", /individual PAN/);
    assert.match(validateQuickApplyStep(5, form({ ...ready, serviceConsent: false })), /consent/i);
  });

  it("does not persist PAN or OTP tokens in draft", () => {
    const draft = toPersistedDraft(
      5,
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

describe("funnel routing after OTP", () => {
  it("skips loan-need when amount and purpose are already valid", () => {
    const prefilled = form({ loanAmount: 50_000, loanPurpose: "Personal expenses" });
    assert.equal(getNextQuickApplyStep(2, prefilled), 4);
    assert.equal(getPreviousQuickApplyStep(4, prefilled), 2);
  });

  it("keeps loan-need when purpose is missing", () => {
    const incomplete = form({ loanAmount: 50_000, loanPurpose: "" });
    assert.equal(getNextQuickApplyStep(2, incomplete), 3);
  });
});

describe("no SMS OTP contract for quick apply validation helpers", () => {
  it("step 1 never requires SMS OTP fields", () => {
    const payload = form({
      fullName: "Rahul Sharma",
      email: "rahul@gmail.com",
      mobile: "9876512345",
      dateOfBirth: "1995-06-15",
      pinCode: "201301",
    });
    assert.equal(validateQuickApplyStep(1, payload), "");
    assert.equal("smsOtp" in payload, false);
  });
});
