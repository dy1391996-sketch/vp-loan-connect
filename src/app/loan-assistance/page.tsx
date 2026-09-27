import type { Metadata } from "next";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { LoanAssistanceEnquiryForm } from "@/components/loan-assistance/enquiry-form";
import { ButtonLink } from "@/components/ui/button";
import { LENDER_OUTCOME_DISCLAIMER, PUBLIC_SUPPORT_EMAIL } from "@/lib/constants";
import {
  LOAN_ASSISTANCE_HEADLINE,
  LOAN_ASSISTANCE_INTRO,
  LOAN_ASSISTANCE_SERVICE_SUMMARY,
  LOAN_ASSISTANCE_TYPES,
} from "@/lib/loan-assistance/constants";

export const metadata: Metadata = {
  title: "Loan Assistance",
  description:
    "Submit a loan-assistance enquiry to VP Loan Connect for information on loan options and application preparation. VP Loan Connect is not a lender.",
  alternates: { canonical: "/loan-assistance" },
  openGraph: {
    title: "Loan Assistance | VP Loan Connect",
    description: LOAN_ASSISTANCE_INTRO,
    url: "/loan-assistance",
  },
};

const steps = [
  ["1", "Understand the category", "See which loan category matches the purpose you have in mind."],
  ["2", "Submit this enquiry", "Share your name, mobile, city, state and loan category."],
  ["3", "Prepare the next step", "If we follow up, it is about information and application preparation. A lender still makes its own decision."],
] as const;

export default function LoanAssistancePage() {
  return (
    <div className="bg-surface pb-28">
      <section className="hero-premium text-white">
        <div className="page-shell grid gap-10 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:py-20">
          <div>
            <p className="text-sm font-extrabold tracking-[0.04em] text-brand-500">VP Loan Connect</p>
            <h1 className="font-display mt-4 max-w-xl text-4xl font-extrabold leading-[1.05] tracking-[-0.05em] sm:text-5xl">
              {LOAN_ASSISTANCE_HEADLINE}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-200">{LOAN_ASSISTANCE_INTRO}</p>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">{LOAN_ASSISTANCE_SERVICE_SUMMARY}</p>
            <div className="mt-8">
              <ButtonLink href="#enquiry" size="lg">
                Submit enquiry <ArrowRight size={18} aria-hidden="true" />
              </ButtonLink>
            </div>
            <p className="mt-6 max-w-xl text-xs leading-6 text-slate-300">{LENDER_OUTCOME_DISCLAIMER}</p>
          </div>
          <LoanAssistanceEnquiryForm />
        </div>
      </section>

      <section className="page-shell py-14" aria-labelledby="loan-categories">
        <h2 id="loan-categories" className="font-display text-2xl font-extrabold tracking-[-0.04em] text-navy-950 sm:text-3xl">
          Loan categories you can ask about
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          These categories describe the kind of guidance you want. They are not lender offers, approvals or a statement that a representative is available in every city.
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LOAN_ASSISTANCE_TYPES.map((category) => (
            <li key={category} className="rounded-2xl border border-line bg-white px-4 py-4 text-sm font-bold text-navy-950">
              {category}
            </li>
          ))}
        </ul>
      </section>

      <section className="page-shell pb-16">
        <h2 className="font-display text-2xl font-extrabold tracking-[-0.04em] text-navy-950">What happens after you enquire</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {steps.map(([number, title, description]) => (
            <li key={number} className="rounded-[1.5rem] border border-line bg-white p-5">
              <span className="font-display text-sm font-black text-brand-600">{number}</span>
              <h3 className="mt-3 font-display text-lg font-extrabold text-navy-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex gap-3 rounded-[1.5rem] border border-line bg-white p-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700">
            <ShieldCheck size={18} aria-hidden="true" />
          </span>
          <p className="text-sm leading-6 text-slate-600">
            Official contact for this website is {PUBLIC_SUPPORT_EMAIL}. Do not send Aadhaar, PAN, bank passwords or card details by email or on this form.
          </p>
        </div>
      </section>
    </div>
  );
}
