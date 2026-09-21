import { ArrowRight, Check } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { LENDER_OUTCOME_DISCLAIMER, USP_GST_LABEL, USP_PRICE_LABEL, USP_TOTAL_WITH_GST_LABEL } from "@/lib/constants";

const BOOSTER_POINTS = [
  "Loan-readiness insights",
  "Matched loan options based on your profile",
  "Key eligibility factors that may affect your application",
  "Guidance on profile areas that may need attention",
  "Official application links where available",
];

type Props = {
  checkoutUrl: string;
  compact?: boolean;
};

/** Credit Profile Booster checkout CTA — same /checkout URL and ₹116.82 total. */
export function CreditProfileBoosterPayCard({ checkoutUrl, compact = false }: Props) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-line bg-white shadow-soft">
      <div className={compact ? "grid" : "grid lg:grid-cols-[1.15fr_0.85fr]"}>
        <div className="p-6">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-700">Your next step</p>
          <h2 className="mt-3 text-2xl font-extrabold text-navy-950">See Your Loan Matches & Readiness</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Unlock your Loan Match & Readiness Report, then complete your profile to view personalized readiness insights and matched loan options.
          </p>
          <p className="mt-3 text-lg font-extrabold text-navy-950">
            {USP_PRICE_LABEL} + {USP_GST_LABEL} GST
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {USP_TOTAL_WITH_GST_LABEL} incl. GST. This service fee is not a lender processing fee.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            {BOOSTER_POINTS.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check className="mt-0.5 shrink-0 text-brand-600" size={15} />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-navy-950 p-6 text-white">
          <p className="text-sm text-slate-300">Service fee {USP_PRICE_LABEL}</p>
          <p className="text-sm text-slate-300">GST (18%) {USP_GST_LABEL}</p>
          <p className="mt-2 text-3xl font-black text-white">Total: {USP_TOTAL_WITH_GST_LABEL}</p>
          <ButtonLink href={checkoutUrl} size="lg" className="mt-6 w-full">
            Unlock My Loan Matches — {USP_TOTAL_WITH_GST_LABEL} <ArrowRight size={18} />
          </ButtonLink>
          <p className="mt-3 text-xs leading-6 text-slate-300">{LENDER_OUTCOME_DISCLAIMER}</p>
        </div>
      </div>
    </div>
  );
}
