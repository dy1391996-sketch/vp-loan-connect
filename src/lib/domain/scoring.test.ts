import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateReadiness, type ScoreInput } from "./scoring";

const strong: ScoreInput = {
  loanAmount: 500000,
  loanType: "PERSONAL",
  employmentType: "SALARIED",
  monthlyIncomeRange: "60000_99999",
  durationMonths: 36,
  salaryBankCredit: true,
  itrAvailable: true,
  gstAvailable: false,
  udyamAvailable: false,
  sixMonthBankStatement: true,
  existingEmi: 8000,
  activeLoans: 1,
  cardOutstanding: 10000,
  currentOverdue: false,
  settledOrWrittenOff: false,
  creditRange: "750_PLUS",
  panAvailable: true,
  aadhaarAvailable: true,
  addressProofAvailable: true,
  incomeProofAvailable: true,
  bankStatementAvailable: true,
  businessRegistrationAvailable: false,
  securedAssetAvailable: true,
};

describe("calculateReadiness", () => {
  it("returns a transparent strong-readiness result", () => {
    const result = calculateReadiness(strong);
    assert.ok(result.readinessScore >= 80);
    assert.equal(result.readinessLabel, "Strong readiness");
    assert.equal(result.factorBreakdown.reduce((sum, item) => sum + item.score, 0), result.readinessScore);
    assert.ok(result.suitableCategories.includes("Personal Loan"));
  });

  it("penalizes high obligations and adverse repayment history", () => {
    const result = calculateReadiness({ ...strong, existingEmi: 60000, currentOverdue: true, creditRange: "BELOW_550", panAvailable: false, incomeProofAvailable: false });
    assert.equal(result.readinessLabel, "High rejection risk");
    assert.equal(result.emiBurden, "Very high");
    assert.equal(result.creditHealthStatus, "High risk");
    assert.ok(result.improvements.some((item) => item.includes("overdue")));
  });

  it("never represents the result as a bureau or lender score", () => {
    const result = calculateReadiness(strong);
    assert.equal(result.engineVersion, "v1.0.0");
    assert.ok(!Object.keys(result).includes("approvedAmount"));
  });
});
