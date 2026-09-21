import type { Metadata } from "next";
import { ProductPage } from "@/components/product/product-page";
import { USP_PRICE_LABEL, USP_PRODUCT_NAME, USP_TOTAL_WITH_GST_LABEL } from "@/lib/constants";

export const metadata: Metadata = {
  title: `${USP_PRODUCT_NAME} — ${USP_PRICE_LABEL}`,
  description: "Understand your loan readiness, key eligibility factors and matched loan options through VP Loan Connect. ₹99 + ₹17.82 GST (₹116.82 total) after email verification. Not a lender fee.",
  alternates: { canonical: "/credit-health" },
};

export default function CreditHealthPage() {
  return (
    <ProductPage
      kind="credit"
      title={`VP ${USP_PRODUCT_NAME}`}
      heading={`${USP_PRODUCT_NAME} after email verification`}
      description="Get a clearer view of your loan readiness, important eligibility factors and matched loan options based on your completed profile."
      price={`Launch price ${USP_PRICE_LABEL} + 18% GST`}
      total={`${USP_TOTAL_WITH_GST_LABEL} total`}
      badge="Loan Match & Readiness Report • Matched loan options"
      deliverables={[
        "Credit profile explained in simple language",
        "Loan-readiness analysis for your answers",
        "Profile-matched bank, NBFC and fintech options",
        "Closer profile matches shown first (educational ranking)",
        "EMI burden and document readiness view",
        "Credit-risk factors and action checklist",
        "Official application handoff links",
        "Downloadable branded PDF",
        "Official support email and Instagram guidance routes",
      ]}
    />
  );
}
