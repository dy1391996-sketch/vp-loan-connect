import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canAccessPaidAssessment, classifyBoosterPaymentState, paidAssessmentGate } from "./entitlement";

describe("booster payment entitlement", () => {
  it("treats only PAID as entitled for the detailed assessment", () => {
    assert.equal(classifyBoosterPaymentState([{ status: "PAID" }]), "PAID");
    assert.equal(canAccessPaidAssessment("PAID"), true);
    assert.deepEqual(paidAssessmentGate("PAID"), { allow: true, code: "OK" });
  });

  it("keeps PENDING locked without marking it failed", () => {
    assert.equal(classifyBoosterPaymentState([{ status: "PENDING" }, { status: "FAILED" }]), "PENDING");
    assert.equal(canAccessPaidAssessment("PENDING"), false);
    assert.deepEqual(paidAssessmentGate("PENDING"), { allow: false, code: "PAYMENT_PENDING" });
  });

  it("blocks unpaid and failed-only histories", () => {
    assert.equal(classifyBoosterPaymentState([]), "UNPAID");
    assert.equal(classifyBoosterPaymentState([{ status: "FAILED" }]), "UNPAID");
    assert.equal(canAccessPaidAssessment("UNPAID"), false);
    assert.deepEqual(paidAssessmentGate("UNPAID"), { allow: false, code: "PAYMENT_REQUIRED" });
  });

  it("prefers PAID when a later webhook succeeds after PENDING", () => {
    assert.equal(classifyBoosterPaymentState([{ status: "PENDING" }, { status: "PAID" }]), "PAID");
    assert.deepEqual(paidAssessmentGate("PAID"), { allow: true, code: "OK" });
  });
});
