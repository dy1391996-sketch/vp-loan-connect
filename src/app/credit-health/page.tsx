import type { Metadata } from "next";
import { ProductPage } from "@/components/product/product-page";
import { USP_PRICE_LABEL, USP_PRODUCT_NAME, USP_TOTAL_WITH_GST_LABEL } from "@/lib/constants";

export const metadata: Metadata = {
  title: `${USP_PRODUCT_NAME} — ${USP_PRICE_LABEL}`,
  description: "₹99 Credit Profile Booster: understand your credit profile, analyse loan readiness, and see profile-matched loan options first.",
  alternates: { canonical: "/credit-health" },
};

export default function CreditHealthPage() {
  return (
    <ProductPage
      kind="credit"
      title={`VP ${USP_PRODUCT_NAME}`}
      heading="Understand your credit profile and profile-matched options for ₹99"
      description="Credit-profile explanation, loan-readiness analysis, and relevant bank, NBFC and fintech options ranked for your answers — not a random list of loan websites."
      regular="₹299 + GST"
      price={`Launch price ${USP_PRICE_LABEL} + 18% GST`}
      total={`${USP_TOTAL_WITH_GST_LABEL} total`}
      badge="Credit Profile Booster • Profile-matched options"
      deliverables={[
        "Credit profile explained in simple language",
        "Loan-readiness analysis for your answers",
        "Profile-matched bank, NBFC and fintech options",
        "Better-fit partners shown first (educational ranking)",
        "EMI burden and document readiness view",
        "Credit-risk factors and action checklist",
        "Official application handoff links",
        "Downloadable branded PDF",
        "Official support email and Instagram guidance routes",
      ]}
    />
  );
}
