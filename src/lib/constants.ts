export const APP_NAME = "VP Loan Connect";
export const TAGLINE = "Smarter Loan Matches Start With Your Profile";
export const DOMAIN = "vploanconnect.in";

export const CONSENT_VERSION = "2026-07-v1";

export const SERVICE_CONSENT_TEXT =
  "I authorize VP Loan Connect to use the information I provide to prepare my requested profile assessment and contact me about this service request.";

export const MARKETING_CONSENT_TEXT =
  "I would like to receive loan-readiness updates, document reminders and verified financial offers by WhatsApp, SMS or call. I can opt out at any time.";

export const LENDER_REFERRAL_CONSENT_TEXT =
  "I request an optional review of my profile for referral to a verified regulated lender or authorized partner. I understand that eligibility, approval, rate and disbursement are not guaranteed, and my data will not be shared without identifying the partner and purpose.";

export const RESULT_DISCLAIMER =
  "This is an indicative profile assessment, not a loan approval. Final eligibility, amount, APR, charges, tenure and disbursement are decided only by the relevant lender after verification.";

export const PLATFORM_DISCLAIMER =
  "VP Loan Connect is a financial-information, profile-assessment and loan-discovery platform. We are not a bank, NBFC, lender or credit bureau. We do not sanction loans or guarantee approval, rates, credit-score improvement or disbursement.";

export const PAYMENT_DESCRIPTION =
  "This payment is for a digital profile assessment, credit-improvement action plan and access to matched loan platforms. It is not a lender processing fee or a guarantee of loan approval.";

export const CREDIT_REPORT_DISCLAIMER =
  "We are not TransUnion CIBIL, Experian, Equifax or CRIF High Mark. We cannot directly change or delete a bureau record and do not guarantee any score increase. Corrections depend on confirmation by the reporting credit institution.";

export const LOAN_CATEGORIES = [
  "Personal Loan",
  "Business Loan",
  "MSME Loan",
  "Mudra Loan Guidance",
  "Gold Loan",
  "Loan Against Property",
  "Credit Health Support",
] as const;

export const LEAD_STAGE_LABELS: Record<string, string> = {
  NEW_LEAD: "New lead",
  OTP_VERIFIED: "OTP verified",
  ASSESSMENT_STARTED: "Assessment started",
  ASSESSMENT_COMPLETED: "Assessment completed",
  FREE_RESULT_VIEWED: "Free result viewed",
  PAYMENT_PENDING: "Payment pending",
  PAID: "Paid",
  REPORT_PROCESSING: "Report processing",
  REPORT_DELIVERED: "Report delivered",
  CONSULTATION_REQUESTED: "Consultation requested",
  LENDER_REFERRAL_REQUESTED: "Lender referral requested",
  REFERRED: "Referred",
  APPLICATION_SUBMITTED: "Application submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  FOLLOW_UP_LATER: "Follow-up later",
  OPTED_OUT: "Opted out",
};
