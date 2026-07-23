import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateEmi } from "./emi";

describe("calculateEmi", () => {
  it("calculates reducing-balance EMI and totals", () => {
    const result = calculateEmi(500000, 14, 36);
    assert.ok(Math.abs(result.monthlyEmi - 17088.81) < 0.1);
    assert.ok(Math.abs(result.totalRepayment - 615197.34) < 0.1);
    assert.ok(Math.abs(result.totalInterest - 115197.34) < 0.1);
  });

  it("supports a zero-interest estimate", () => {
    assert.deepEqual(calculateEmi(120000, 0, 12), { monthlyEmi: 10000, totalRepayment: 120000, totalInterest: 0 });
  });

  it("rejects invalid inputs", () => {
    assert.throws(() => calculateEmi(0, 12, 12));
    assert.throws(() => calculateEmi(100000, -1, 12));
    assert.throws(() => calculateEmi(100000, 12, 0));
  });
});
