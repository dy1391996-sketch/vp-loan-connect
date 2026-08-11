import type { Metadata } from "next";
import { ProductPage } from "@/components/product/product-page";

export const metadata: Metadata = {
  title: "Complete Loan Readiness Report",
  description:
    "Deeper educational readiness report (₹299 launch offer): income analysis, document checklist and preparation roadmap. Separate from the ₹99 Credit Profile Booster.",
  alternates: { canonical: "/loan-readiness" },
};

export default function LoanReadinessPage() {
  return (
    <ProductPage
      kind="readiness"
      title="Complete Loan Readiness Report"
      heading="Application से पहले अपनी complete readiness समझें"
      description="Income, obligations, internal readiness, documents और category fit का personalized educational report—lender sanction या processing service नहीं. यह ₹99 Credit Profile Booster से अलग, deeper readiness product है."
      regular="₹599 + GST"
      price="Launch offer ₹299 + 18% GST"
      total="₹352.82 total"
      badge="Deeper report • Separate from ₹99 Booster"
      deliverables={[
        "Financial-profile summary",
        "Monthly income and obligation analysis",
        "EMI-to-income ratio",
        "Internal loan-readiness score",
        "Strengths and rejection risks",
        "Credit-health observations",
        "Missing-document checklist",
        "Suitable general loan categories",
        "Indicative comfortable EMI range",
        "Application-preparation roadmap",
        "30-day action plan",
        "Branded PDF report",
        "15-minute guidance consultation request",
        "Optional verified lender-referral request",
      ]}
    />
  );
}
