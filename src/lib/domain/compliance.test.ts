import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assessmentSchema } from "./assessment-schema";
import { hasActiveConsent } from "./consent";
import { isValidReferral, qualifiesForReferralReward } from "./referrals";

describe("assessment and consent rules", () => {
  it("requires separate affirmative service consent", () => { const partial = assessmentSchema.safeParse({ serviceConsent: false }); assert.equal(partial.success, false); if (!partial.success) assert.ok(partial.error.flatten().fieldErrors.serviceConsent); });
  it("does not treat missing or withdrawn marketing consent as active", () => { const now = new Date(); assert.equal(hasActiveConsent([], "MARKETING"), false); assert.equal(hasActiveConsent([{ type: "MARKETING", accepted: true, createdAt: now, withdrawnAt: now }], "MARKETING"), false); assert.equal(hasActiveConsent([{ type: "MARKETING", accepted: true, createdAt: now }], "MARKETING", now), false); });
  it("allows active service consent independently of marketing", () => { const now = new Date(); assert.equal(hasActiveConsent([{ type: "SERVICE", accepted: true, createdAt: now }], "SERVICE"), true); });
});

describe("referral fraud controls", () => {
  it("blocks self-referral by lead id or mobile", () => { assert.equal(isValidReferral({ referrerId: "a", referredId: "a", referrerMobile: "+919900000001", referredMobile: "+919900000002" }), false); assert.equal(isValidReferral({ referrerId: "a", referredId: "b", referrerMobile: "+919900000001", referredMobile: "+919900000001" }), false); });
  it("rewards only a unique, paid, non-refunded qualifying product order", () => { const base = { orderStatus: "PAID", refunded: false, productType: "CREDIT_HEALTH_ACTION_PLAN" as const, existingRewardForOrder: false }; assert.equal(qualifiesForReferralReward(base), true); assert.equal(qualifiesForReferralReward({ ...base, existingRewardForOrder: true }), false); assert.equal(qualifiesForReferralReward({ ...base, refunded: true }), false); assert.equal(qualifiesForReferralReward({ ...base, orderStatus: "PENDING" }), false); });
});
