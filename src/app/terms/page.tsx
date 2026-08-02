import type { Metadata } from "next";
import { PolicyPage } from "@/components/legal/policy-page";

export const metadata: Metadata = { title: "Terms and Conditions", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return <PolicyPage title="Terms and Conditions" summary="These terms govern use of VP Loan Connect's educational profile-assessment, report, referral and support services." sections={[
    { title: "Service scope", paragraphs: ["VP Loan Connect is not a bank, NBFC, lender or credit bureau. It does not sanction loans, set lender rates, guarantee disbursement or guarantee credit-score improvement."] },
    { title: "User responsibilities", bullets: ["Provide accurate information and use only a mobile number you control.", "Do not submit another person's data without authority.", "Do not misuse OTP, payment, referral or report links.", "Independently verify lender terms, fees and identity before proceeding."] },
    { title: "Assessment limitations", paragraphs: ["Scores, categories and EMI comfort ranges are internal educational estimates based on self-reported inputs. They are not credit-bureau scores, pre-approvals or lender decisions."] },
    { title: "Paid reports", paragraphs: ["Payment covers personalized assessment, report preparation and educational guidance—not a lender processing, approval or sanction fee. GST is shown separately where applicable."] },
    { title: "Referrals", paragraphs: ["Rewards apply only to eligible, completed, non-refunded orders after validation. Self-referral, duplicate-mobile abuse, payment fraud and misleading promotion may cause rejection or reversal."] },
    { title: "Acceptable use", paragraphs: ["Automated abuse, scraping protected data, credential attacks, impersonation, unlawful financial solicitation and false approval claims are prohibited."] },
    { title: "Applicable law", paragraphs: ["These terms and services are subject to applicable laws in India. Mandatory consumer rights and lawful jurisdiction rules continue to apply."] },
  ]} />;
}
