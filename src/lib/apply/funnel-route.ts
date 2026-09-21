import { USP_PRODUCT_SLUG } from "@/lib/constants";

/** Quick Apply screens. Profile screens are only valid after the booster is paid. */
export const SCREEN = {
  REQUIREMENT: 1,
  EMAIL: 2,
  BOOSTER: 3,
  WORK: 4,
  PAN: 5,
} as const;

export const FUNNEL_PROGRESS_LABELS = ["Requirement", "Verify Email", "Booster", "Profile", "Results"] as const;

export function isProfileScreen(step: number): boolean {
  return step === SCREEN.WORK || step === SCREEN.PAN;
}

/** Progress indicator index (1–5), collapsing the two profile screens into one stage. */
export function progressIndexForScreen(step: number): number {
  if (step <= SCREEN.REQUIREMENT) return 1;
  if (step === SCREEN.EMAIL) return 2;
  if (step === SCREEN.BOOSTER) return 3;
  if (isProfileScreen(step)) return 4;
  return 5;
}

/** Successful email OTP always opens the Credit Profile Booster, never work/profile questions. */
export function screenAfterEmailVerification(): number {
  return SCREEN.BOOSTER;
}

/** Verified payment opens the detailed profile. */
export function screenAfterVerifiedPayment(): number {
  return SCREEN.WORK;
}

export function canEnterProfileScreen(paid: boolean): boolean {
  return paid;
}

/** Unpaid visitors stay on the booster. Paid visitors resume the detailed profile. */
export function clampQuickApplyScreen(step: number, paid: boolean): number {
  const normalized = Math.min(SCREEN.PAN, Math.max(SCREEN.REQUIREMENT, Math.round(Number(step)) || SCREEN.REQUIREMENT));
  if (!paid && isProfileScreen(normalized)) return SCREEN.BOOSTER;
  if (paid && normalized <= SCREEN.BOOSTER) return SCREEN.WORK;
  return normalized;
}

export function getNextQuickApplyStep(step: number, paid = false): number {
  if (step <= SCREEN.REQUIREMENT) return SCREEN.EMAIL;
  if (step === SCREEN.EMAIL) return screenAfterEmailVerification();
  if (step === SCREEN.BOOSTER) return paid ? screenAfterVerifiedPayment() : SCREEN.BOOSTER;
  if (step === SCREEN.WORK) return SCREEN.PAN;
  return SCREEN.PAN;
}

export function getPreviousQuickApplyStep(step: number): number {
  if (step <= SCREEN.REQUIREMENT) return SCREEN.REQUIREMENT;
  if (step === SCREEN.EMAIL) return SCREEN.REQUIREMENT;
  if (step === SCREEN.BOOSTER) return SCREEN.REQUIREMENT;
  if (step === SCREEN.WORK) return SCREEN.WORK;
  return step - 1;
}

/** Same assessment and token always resolve to the same checkout URL so refresh reuses the order. */
export function creditProfileBoosterCheckoutPath(assessmentId: string, accessToken: string): string {
  const params = new URLSearchParams({
    product: USP_PRODUCT_SLUG,
    assessment: assessmentId,
    token: accessToken,
  });
  return `/checkout?${params.toString()}`;
}

export function quickApplyResumePath(assessmentId: string, accessToken: string): string {
  const params = new URLSearchParams({
    assessment: assessmentId,
    token: accessToken,
  });
  return `/apply/quick?${params.toString()}`;
}

/** Block a second checkout start while one is already in flight or the booster is paid. */
export function shouldStartNewCheckout(input: { paid: boolean; inFlight: boolean }): boolean {
  return !input.paid && !input.inFlight;
}

/** Detailed profile submission from Quick Apply requires a verified booster payment. */
export function canCompleteDetailedProfile(paid: boolean): boolean {
  return paid;
}
