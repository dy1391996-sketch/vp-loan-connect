import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPaymentReportSnapshot,
  continueQuickApplyHref,
  isCheckoutEligibleAssessmentStatus,
  isPendingProfileSnapshot,
  leadStageAfterPayment,
} from "./early-checkout";

describe("early checkout eligibility", () => {
  it("allows STARTED and COMPLETED assessments to create the existing booster order", () => {
    assert.equal(isCheckoutEligibleAssessmentStatus("STARTED"), true);
    assert.equal(isCheckoutEligibleAssessmentStatus("COMPLETED"), true);
  });

  it("rejects abandoned or missing assessment status", () => {
    assert.equal(isCheckoutEligibleAssessmentStatus("ABANDONED"), false);
    assert.equal(isCheckoutEligibleAssessmentStatus(null), false);
    assert.equal(isCheckoutEligibleAssessmentStatus("PAID"), false);
  });
});

describe("payment report snapshot", () => {
  it("marks a pending profile when eligibility score is not ready yet", () => {
    const snapshot = buildPaymentReportSnapshot({
      customerName: "Rahul Sharma",
      assessmentDate: null,
      loanType: "PERSONAL",
      loanAmount: "50000",
      loanPurpose: "Personal expenses",
      employmentType: null,
      monthlyIncomeRange: null,
      existingEmi: null,
      creditRange: null,
      score: null,
      answers: [],
      productName: "Credit Profile Booster",
    });
    assert.equal(snapshot.pendingProfile, true);
    assert.equal(isPendingProfileSnapshot(snapshot), true);
    assert.equal(snapshot.score, undefined);
  });

  it("keeps the full snapshot for completed paid assessments", () => {
    const snapshot = buildPaymentReportSnapshot({
      customerName: "Rahul Sharma",
      assessmentDate: "2026-08-18",
      loanType: "PERSONAL",
      loanAmount: "50000",
      employmentType: "SALARIED",
      monthlyIncomeRange: "40000_59999",
      existingEmi: "0",
      creditRange: "UNKNOWN",
      score: { readinessScore: 62 },
      answers: [{ questionKey: "email", value: "rahul@gmail.com" }],
      productName: "Credit Profile Booster",
    });
    assert.equal(snapshot.pendingProfile, false);
    assert.equal(isPendingProfileSnapshot(snapshot), false);
    assert.deepEqual(snapshot.score, { readinessScore: 62 });
  });

  it("sets lead stage to PAID until the detailed assessment produces a score", () => {
    assert.equal(leadStageAfterPayment(false), "PAID");
    assert.equal(leadStageAfterPayment(true), "REPORT_PROCESSING");
  });

  it("returns users to Quick Apply after verified payment without putting secrets in the path", () => {
    const href = continueQuickApplyHref("11111111-1111-1111-1111-111111111111", "result-token-value");
    assert.match(href, /^\/apply\/quick\?/);
    assert.match(href, /paid=1/);
    assert.match(href, /assessment=11111111-1111-1111-1111-111111111111/);
    assert.equal(href.includes("/otp"), false);
    assert.equal(/pan=/i.test(href), false);
  });
});
