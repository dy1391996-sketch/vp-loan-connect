import { ArrowRight, Check, Zap } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { USP_PRICE_LABEL, USP_TOTAL_WITH_GST_LABEL } from "@/lib/constants";

const BOOSTER_POINTS = [
  "Detailed credit-profile explanation",
  "Personalized improvement plan",
  "Downloadable action-plan PDF",
  "Secure report access",
];

type Props = {
  checkoutUrl: string;
  compact?: boolean;
};

/** Existing Credit Profile Booster checkout CTA — same /checkout URL and ₹116.82 total. */
export function CreditProfileBoosterPayCard({ checkoutUrl, compact = false }: Props) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-brand-500/30">
      <div className={compact ? "grid" : "grid lg:grid-cols-[1.15fr_0.85fr]"}>
        <div className="p-6">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-700">Credit Profile Booster</p>
          <h2 className="mt-3 text-2xl font-extrabold text-navy-950">Optional Credit Profile Booster</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Your eligibility result is already available. This optional service fee adds the downloadable action plan. It is not a lender processing fee and not a loan approval.
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
          <Zap className="text-brand-500" size={26} />
          <p className="mt-4 text-sm text-slate-300">Service fee {USP_PRICE_LABEL}</p>
          <p className="text-sm text-slate-300">GST (18%) ₹17.82</p>
          <p className="mt-2 text-3xl font-black text-brand-500">{USP_TOTAL_WITH_GST_LABEL}</p>
          <ButtonLink href={checkoutUrl} size="lg" className="mt-6 w-full">
            Continue with Credit Profile Booster — {USP_TOTAL_WITH_GST_LABEL} <ArrowRight size={18} />
          </ButtonLink>
          <p className="mt-3 text-xs leading-6 text-slate-400">
            ₹99 + ₹17.82 GST. Fee is for the booster report, not a lender processing fee.
          </p>
        </div>
      </div>
    </div>
  );
}
