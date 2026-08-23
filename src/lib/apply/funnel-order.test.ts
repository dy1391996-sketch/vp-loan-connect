import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getNextQuickApplyStep, validateQuickApplyStep } from "./quick-apply-validation";
import { defaultQuickApplyForm } from "./quick-apply-state";
import {
  PAYMENT_STEP,
  POST_PAYMENT_FIRST_STEP,
  QUICK_APPLY_FUNNEL,
  paymentComesBeforeDetailedAssessment,
  startStepCollectsLoanNeed,
} from "./funnel-order";

/**
 * CRITICAL REGRESSION: the owner funnel is early payment, then detailed assessment.
 * If this test fails, payment was moved after the full questionnaire — revert that.
 */
describe("early-payment funnel contract (do not invert)", () => {
  it("keeps the product sequence start → OTP → ₹116.82 payment → detailed assessment", () => {
    assert.deepEqual(
      QUICK_APPLY_FUNNEL.map((item) => item.phase),
      ["start", "otp", "payment", "profile", "consent", "result"],
    );
    assert.equal(paymentComesBeforeDetailedAssessment(), true);
    assert.equal(startStepCollectsLoanNeed(), false);
    assert.equal(PAYMENT_STEP, 3);
    assert.equal(POST_PAYMENT_FIRST_STEP, 4);
    assert.ok(PAYMENT_STEP < POST_PAYMENT_FIRST_STEP);
  });

  it("does not require the loan/profile questionnaire before payment", () => {
    const identityOnly = {
      ...defaultQuickApplyForm(),
      fullName: "Rahul Sharma",
      email: "rahul@gmail.com",
      mobile: "9876512345",
      loanAmount: 0,
      loanPurpose: "",
    };
    assert.equal(validateQuickApplyStep(1, identityOnly), "");
    assert.match(validateQuickApplyStep(4, identityOnly), /loan amount|funds for|date of birth|employment/i);
  });

  it("blocks unpaid users from leaving the payment step into detailed assessment", () => {
    assert.equal(getNextQuickApplyStep(2), PAYMENT_STEP);
    assert.equal(getNextQuickApplyStep(PAYMENT_STEP, false), PAYMENT_STEP);
    assert.equal(getNextQuickApplyStep(PAYMENT_STEP, true), POST_PAYMENT_FIRST_STEP);
  });
});
