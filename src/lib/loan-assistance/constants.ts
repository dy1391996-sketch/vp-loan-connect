/** Public loan-assistance enquiry. This is not the paid readiness-report offer. */

export const LOAN_ASSISTANCE_PATH = "/loan-assistance";
export const LOAN_ASSISTANCE_SOURCE = "instagram_loan_assistance";
export const LOAN_ASSISTANCE_CONSENT_VERSION = "2026-09-enquiry-v1";
export const LOAN_ASSISTANCE_DUPLICATE_WINDOW_MS = 5 * 24 * 60 * 60 * 1000;
export const VPLC_TEST_NAME_PREFIX = "[VPLC-TEST] ";

export const LOAN_ASSISTANCE_TYPES = [
  "Personal loan",
  "Business loan",
  "MSME loan",
  "Home loan",
  "Loan against property",
  "Education loan",
  "Working capital",
] as const;

export type LoanAssistanceType = (typeof LOAN_ASSISTANCE_TYPES)[number];

export const INDIAN_STATES_AND_UTS = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export const ENQUIRY_FOLLOW_UP_CONSENT_TEXT =
  "I agree that VP Loan Connect may contact me about this loan-assistance enquiry to explain the service and help me prepare information for a possible lender application. This is not a loan application or an approval, and it does not authorise sharing my details with a lender.";

export const LOAN_ASSISTANCE_INTRO =
  "Loan options samajhiye aur application ki taiyari kijiye. VP Loan Connect ke saath loan assistance ke liye enquiry submit karein.";

export const LOAN_ASSISTANCE_HEADLINE = "Loan Assistance";

export const LOAN_ASSISTANCE_SERVICE_SUMMARY =
  "VP Loan Connect is a loan-information, profile-assessment and loan-discovery platform. This enquiry is for guidance on loan options and application preparation. VP Loan Connect is not a bank, NBFC or direct lender.";
