export const APP_NAME = "VP Loan Connect";
export const TAGLINE = "Smart Profile Check Before Your Loan Application";
export const DOMAIN = "vploanconnect.in";

export const CONSENT_VERSION = "2026-07-v1";

export const SERVICE_CONSENT_TEXT =
  "I agree that VP Loan Connect may use the information entered by me to generate my requested profile assessment and contact me regarding this request.";

export const MARKETING_CONSENT_TEXT =
  "I would like to receive relevant loan-readiness updates, document reminders, educational content and verified financial offers through WhatsApp, SMS or call. I can opt out anytime by sending STOP.";

export const LENDER_REFERRAL_CONSENT_TEXT =
  "I request VP Loan Connect to review my profile for an optional referral to a verified regulated lender or authorized partner. I understand that no partnership, eligibility, approval, rate or disbursement is guaranteed, and my information will not be shared until an appropriate verified partner and purpose are disclosed.";

export const RESULT_DISCLAIMER =
  "This is a preliminary educational assessment and not a loan approval. Final eligibility, amount, interest rate, charges and disbursement are decided solely by the lender after verification.";

export const PLATFORM_DISCLAIMER =
  "VP Loan Connect is a financial education, profile-assessment and loan-readiness platform. We are not a bank, NBFC, lender or credit bureau. We do not sanction loans and do not guarantee approval, interest rate, credit-score improvement or disbursement. Final decisions are made solely by regulated lenders according to their policies.";

export const PAYMENT_DESCRIPTION =
  "This payment is for profile assessment, report preparation and educational guidance. It is not a lender processing fee, approval fee or guarantee of sanction.";

export const CREDIT_REPORT_DISCLAIMER =
  "We are not TransUnion CIBIL, Experian, Equifax or CRIF High Mark. We cannot directly alter or delete credit-bureau records and cannot guarantee an increase in score. Genuine corrections depend on confirmation by the relevant lender or credit institution.";

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
