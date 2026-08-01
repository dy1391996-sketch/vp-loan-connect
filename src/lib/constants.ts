export const APP_NAME = "VP Loan Connect";
export const TAGLINE = "Loan Application से पहले Smart Profile Check";
export const DOMAIN = "vploanconnect.in";

export const CONSENT_VERSION = "2026-07-v1";

export const SERVICE_CONSENT_TEXT =
  "मैं सहमत हूँ कि VP Loan Connect मेरी दी गई जानकारी का उपयोग मेरा requested profile assessment तैयार करने और इसी request के संबंध में मुझसे संपर्क करने के लिए कर सकता है।";

export const MARKETING_CONSENT_TEXT =
  "मैं WhatsApp, SMS या call पर loan-readiness updates, document reminders, जानकारी और verified financial offers पाना चाहता/चाहती हूँ। मैं STOP भेजकर इसे कभी भी बंद कर सकता/सकती हूँ।";

export const LENDER_REFERRAL_CONSENT_TEXT =
  "मैं VP Loan Connect से अपनी profile को verified regulated lender या authorized partner के optional referral के लिए review करने का अनुरोध करता/करती हूँ। मैं समझता/समझती हूँ कि eligibility, approval, rate या disbursement की guarantee नहीं है और verified partner व उद्देश्य बताए बिना मेरी जानकारी साझा नहीं होगी।";

export const RESULT_DISCLAIMER =
  "यह शुरुआती profile assessment है, loan approval नहीं। अंतिम eligibility, amount, interest rate, charges और disbursement verification के बाद केवल संबंधित lender तय करता है।";

export const PLATFORM_DISCLAIMER =
  "VP Loan Connect financial information, profile assessment और loan-readiness platform है। हम bank, NBFC, lender या credit bureau नहीं हैं। हम loan sanction नहीं करते और approval, interest rate, credit-score improvement या disbursement की guarantee नहीं देते। अंतिम निर्णय regulated lender अपनी policy के अनुसार करता है।";

export const PAYMENT_DESCRIPTION =
  "यह payment profile assessment, personalized report और guidance के लिए है। यह lender processing fee, approval fee या loan sanction की guarantee नहीं है।";

export const CREDIT_REPORT_DISCLAIMER =
  "हम TransUnion CIBIL, Experian, Equifax या CRIF High Mark नहीं हैं। हम credit-bureau record को सीधे बदल या delete नहीं कर सकते और score बढ़ने की guarantee नहीं देते। सही correction संबंधित lender या credit institution की पुष्टि पर निर्भर करता है।";

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
