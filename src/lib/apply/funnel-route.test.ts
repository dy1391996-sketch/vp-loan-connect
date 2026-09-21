import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SCREEN,
  canCompleteDetailedProfile,
  canEnterProfileScreen,
  clampQuickApplyScreen,
  creditProfileBoosterCheckoutPath,
  getNextQuickApplyStep,
  getPreviousQuickApplyStep,
  progressIndexForScreen,
  quickApplyResumePath,
  screenAfterEmailVerification,
  screenAfterVerifiedPayment,
  shouldStartNewCheckout,
} from "./funnel-route";

const ASSESSMENT = "11111111-1111-4111-8111-111111111111";
const TOKEN = "result-token-value-1234567890";

describe("OTP success opens the booster, not the profile", () => {
  it("sends a verified email to the Credit Profile Booster screen", () => {
    assert.equal(screenAfterEmailVerification(), SCREEN.BOOSTER);
    assert.equal(getNextQuickApplyStep(SCREEN.EMAIL), SCREEN.BOOSTER);
    assert.equal(getNextQuickApplyStep(SCREEN.EMAIL, false), SCREEN.BOOSTER);
    assert.notEqual(screenAfterEmailVerification(), SCREEN.WORK);
    assert.notEqual(screenAfterEmailVerification(), SCREEN.PAN);
  });

  it("does not advance an unpaid booster into work or PAN questions", () => {
    assert.equal(getNextQuickApplyStep(SCREEN.BOOSTER, false), SCREEN.BOOSTER);
    assert.equal(canEnterProfileScreen(false), false);
  });
});

describe("booster checkout handoff", () => {
  it("builds one stable Cashfree checkout path for the booster", () => {
    const first = creditProfileBoosterCheckoutPath(ASSESSMENT, TOKEN);
    const second = creditProfileBoosterCheckoutPath(ASSESSMENT, TOKEN);
    assert.equal(first, second);
    assert.match(first, /^\/checkout\?/);
    assert.match(first, /product=credit-health-action-plan/);
    assert.match(first, new RegExp(`assessment=${ASSESSMENT}`));
    assert.equal(first.includes("/apply/quick"), false);
  });

  it("does not start a second checkout while one is in flight or already paid", () => {
    assert.equal(shouldStartNewCheckout({ paid: false, inFlight: false }), true);
    assert.equal(shouldStartNewCheckout({ paid: false, inFlight: true }), false);
    assert.equal(shouldStartNewCheckout({ paid: true, inFlight: false }), false);
    assert.equal(shouldStartNewCheckout({ paid: true, inFlight: true }), false);
  });
});

describe("payment success and failure resume", () => {
  it("opens the detailed profile only after verified payment", () => {
    assert.equal(screenAfterVerifiedPayment(), SCREEN.WORK);
    assert.equal(getNextQuickApplyStep(SCREEN.BOOSTER, true), SCREEN.WORK);
    assert.equal(canEnterProfileScreen(true), true);
    assert.equal(canCompleteDetailedProfile(true), true);
    assert.equal(canCompleteDetailedProfile(false), false);
  });

  it("keeps an unpaid refresh on the booster and resumes a paid profile", () => {
    assert.equal(clampQuickApplyScreen(SCREEN.WORK, false), SCREEN.BOOSTER);
    assert.equal(clampQuickApplyScreen(SCREEN.PAN, false), SCREEN.BOOSTER);
    assert.equal(clampQuickApplyScreen(SCREEN.BOOSTER, false), SCREEN.BOOSTER);
    assert.equal(clampQuickApplyScreen(SCREEN.EMAIL, false), SCREEN.EMAIL);
    assert.equal(clampQuickApplyScreen(SCREEN.BOOSTER, true), SCREEN.WORK);
    assert.equal(clampQuickApplyScreen(SCREEN.REQUIREMENT, true), SCREEN.WORK);
    assert.equal(clampQuickApplyScreen(SCREEN.PAN, true), SCREEN.PAN);
  });

  it("returns a failed payment to Quick Apply without dropping the verified session", () => {
    const href = quickApplyResumePath(ASSESSMENT, TOKEN);
    assert.match(href, /^\/apply\/quick\?/);
    assert.match(href, new RegExp(`assessment=${ASSESSMENT}`));
    assert.equal(href.includes("paid=1"), false);
    assert.equal(/pan=/i.test(href), false);
  });

  it("maps screens onto the five-step progress indicator", () => {
    assert.equal(progressIndexForScreen(SCREEN.REQUIREMENT), 1);
    assert.equal(progressIndexForScreen(SCREEN.EMAIL), 2);
    assert.equal(progressIndexForScreen(SCREEN.BOOSTER), 3);
    assert.equal(progressIndexForScreen(SCREEN.WORK), 4);
    assert.equal(progressIndexForScreen(SCREEN.PAN), 4);
    assert.equal(getPreviousQuickApplyStep(SCREEN.BOOSTER), SCREEN.REQUIREMENT);
    assert.equal(getPreviousQuickApplyStep(SCREEN.WORK), SCREEN.WORK);
    assert.equal(getPreviousQuickApplyStep(SCREEN.PAN), SCREEN.WORK);
  });
});
