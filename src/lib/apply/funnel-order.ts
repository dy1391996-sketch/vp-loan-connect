/**
 * VP Loan Connect business funnel (owner requirement — do not invert).
 *
 * Required product sequence:
 *   1. Minimum start / email OTP
 *   2. ₹116.82 Credit Profile Booster payment
 *   3. Detailed paid assessment
 *
 * Do NOT move payment after the full profile questionnaire unless the owner
 * explicitly changes this product decision. The automated test in
 * `funnel-order.test.ts` exists so agents cannot silently revert to
 * "full assessment → payment".
 */

export const QUICK_APPLY_ROUTE = "/apply/quick";
export const CHECKOUT_ROUTE = "/checkout";
export const CASHFREE_LAUNCH_ROUTE = "/payment/launch";
export const POST_PAYMENT_FIRST_STEP = 4;
export const PAYMENT_STEP = 3;
export const OTP_STEP = 2;
export const START_STEP = 1;

export const QUICK_APPLY_FUNNEL = [
  { step: 1, phase: "start", route: QUICK_APPLY_ROUTE, requiresPaid: false, collectsLoanNeed: false },
  { step: 2, phase: "otp", route: QUICK_APPLY_ROUTE, requiresPaid: false, collectsLoanNeed: false },
  { step: 3, phase: "payment", route: CHECKOUT_ROUTE, requiresPaid: false, collectsLoanNeed: false },
  { step: 4, phase: "profile", route: QUICK_APPLY_ROUTE, requiresPaid: true, collectsLoanNeed: true },
  { step: 5, phase: "consent", route: QUICK_APPLY_ROUTE, requiresPaid: true, collectsLoanNeed: false },
  { step: 6, phase: "result", route: QUICK_APPLY_ROUTE, requiresPaid: true, collectsLoanNeed: false },
] as const;

export type QuickApplyFunnelPhase = (typeof QUICK_APPLY_FUNNEL)[number]["phase"];

export function isPostPaymentStep(step: number): boolean {
  return step >= POST_PAYMENT_FIRST_STEP;
}

export function paymentComesBeforeDetailedAssessment(): boolean {
  const payment = QUICK_APPLY_FUNNEL.find((item) => item.phase === "payment");
  const profile = QUICK_APPLY_FUNNEL.find((item) => item.phase === "profile");
  return Boolean(payment && profile && payment.step < profile.step);
}

export function startStepCollectsLoanNeed(): boolean {
  return QUICK_APPLY_FUNNEL.some((item) => item.step === START_STEP && item.collectsLoanNeed);
}

export function boosterCheckoutHref(assessmentId: string, accessToken: string, productSlug: string): string {
  const params = new URLSearchParams({
    product: productSlug,
    assessment: assessmentId,
    token: accessToken,
  });
  return `${CHECKOUT_ROUTE}?${params.toString()}`;
}
