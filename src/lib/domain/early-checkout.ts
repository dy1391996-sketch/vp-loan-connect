import type { AssessmentStatus } from "@prisma/client";

/** Draft (STARTED) and completed assessments may create the existing ₹116.82 booster order. */
export const CHECKOUT_ELIGIBLE_ASSESSMENT_STATUSES = ["STARTED", "COMPLETED"] as const;

export type CheckoutEligibleAssessmentStatus = (typeof CHECKOUT_ELIGIBLE_ASSESSMENT_STATUSES)[number];

export function isCheckoutEligibleAssessmentStatus(
  status: string | AssessmentStatus | null | undefined,
): status is CheckoutEligibleAssessmentStatus {
  return status === "STARTED" || status === "COMPLETED";
}

export function isPendingProfileSnapshot(snapshot: unknown): boolean {
  return Boolean(
    snapshot &&
      typeof snapshot === "object" &&
      "pendingProfile" in snapshot &&
      (snapshot as { pendingProfile?: unknown }).pendingProfile === true,
  );
}

export type PaymentReportSnapshotInput = {
  customerName: string;
  assessmentDate: Date | string | null;
  loanType: string | null;
  loanAmount: string | null;
  loanPurpose?: string | null;
  employmentType: string | null;
  monthlyIncomeRange: string | null;
  existingEmi: string | null;
  creditRange: string | null;
  score: unknown | null;
  answers: unknown;
  productName: string;
};

/** Full snapshot after eligibility exists; pending snapshot if the user paid before completing the profile. */
export function buildPaymentReportSnapshot(input: PaymentReportSnapshotInput): Record<string, unknown> {
  if (!input.score) {
    return {
      pendingProfile: true,
      customerName: input.customerName,
      loanType: input.loanType,
      loanAmount: input.loanAmount,
      loanPurpose: input.loanPurpose ?? null,
      productName: input.productName,
    };
  }
  return {
    pendingProfile: false,
    customerName: input.customerName,
    assessmentDate: input.assessmentDate,
    loanType: input.loanType,
    loanAmount: input.loanAmount,
    employmentType: input.employmentType,
    monthlyIncomeRange: input.monthlyIncomeRange,
    existingEmi: input.existingEmi,
    creditRange: input.creditRange,
    score: input.score,
    answers: input.answers,
    productName: input.productName,
  };
}

export function leadStageAfterPayment(hasScore: boolean): "PAID" | "REPORT_PROCESSING" {
  return hasScore ? "REPORT_PROCESSING" : "PAID";
}

export function continueQuickApplyHref(assessmentId: string, resultToken: string): string {
  const params = new URLSearchParams({
    paid: "1",
    assessment: assessmentId,
    token: resultToken,
  });
  return `/apply/quick?${params.toString()}`;
}
