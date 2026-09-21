import type { Metadata } from "next";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { LENDER_OUTCOME_DISCLAIMER, USP_GST_LABEL, USP_PRICE_LABEL, USP_TOTAL_WITH_GST_LABEL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Quick Apply — Loan Match & Readiness Report",
  description: `Understand your loan readiness, key eligibility factors and matched loan options through VP Loan Connect. ${USP_PRICE_LABEL} + ${USP_GST_LABEL} GST (${USP_TOTAL_WITH_GST_LABEL}).`,
  alternates: { canonical: "/assessment" },
};

export default async function AssessmentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  const amount = typeof params.amount === "string" ? params.amount : "";
  const purpose = typeof params.purpose === "string" ? params.purpose : "";
  if (amount) query.set("amount", amount);
  if (purpose) query.set("purpose", purpose);
  const href = query.toString() ? `/apply/quick?${query.toString()}` : "/apply/quick";

  return (
    <section className="surface-grid min-h-[70vh] bg-surface py-16">
      <div className="page-shell">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-line bg-white p-8 shadow-soft sm:p-12">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-700">Quick Apply</p>
          <h1 className="font-display mt-4 text-4xl font-extrabold tracking-[-0.045em] text-navy-950">Start with your loan requirement</h1>
          <p className="mt-4 text-base leading-8 text-slate-600">
            Verify your email, then unlock your Loan Match & Readiness Report at {USP_PRICE_LABEL} + {USP_GST_LABEL} GST. Total: {USP_TOTAL_WITH_GST_LABEL}. Work, income and PAN are collected after that payment.
          </p>
          <ul className="mt-6 grid gap-3 text-sm font-semibold text-navy-950">
            {["Tell Us Your Requirement", "Verify Email", `Unlock Loan Matches — ${USP_TOTAL_WITH_GST_LABEL}`, "Complete Profile", "View Options"].map((item) => (
              <li key={item} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3">
                <ShieldCheck className="text-brand-600" size={16} />
                {item}
              </li>
            ))}
          </ul>
          <ButtonLink href={href} size="lg" className="mt-8">
            Check My Loan Options <ArrowRight size={18} />
          </ButtonLink>
          <p className="mt-6 flex items-start gap-2 text-xs leading-6 text-slate-500">
            <LockKeyhole className="mt-0.5 shrink-0" size={14} />
            {LENDER_OUTCOME_DISCLAIMER}
          </p>
        </div>
      </div>
    </section>
  );
}
