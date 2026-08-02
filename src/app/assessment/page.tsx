import type { Metadata } from "next";
import { Suspense } from "react";
import { Clock3, FileCheck2, LockKeyhole, Sparkles } from "lucide-react";
import { AssessmentForm } from "@/components/assessment/assessment-form";

export const metadata: Metadata = {
  title: "Free Loan Profile Assessment",
  description: "Complete a secure, OTP-verified borrower profile assessment with PAN and income details.",
};

export default function AssessmentPage() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-surface">
      <div className="hero-premium relative overflow-hidden text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="animate-pulse-soft absolute -right-20 top-0 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" />
        </div>
        <div className="page-shell relative py-14 sm:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-display text-sm font-extrabold tracking-[0.28em] text-brand-500">VP LOAN CONNECT</p>
            <p className="mt-4 inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">
              <Sparkles size={14} className="text-brand-500" />
              Free profile check
            </p>
            <h1 className="font-display mt-5 text-balance text-3xl font-extrabold tracking-[-0.05em] sm:text-5xl">
              Check your loan options
              <span className="mt-2 block text-brand-500">in five simple steps</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              Amount, PAN, income aur CIBIL details batao — free indicative result pehle. Document upload nahi chahiye.
            </p>
            <div className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-3 text-xs font-bold text-slate-300">
              <span className="flex items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-4 py-2.5 backdrop-blur">
                <Clock3 className="text-brand-500" size={16} />
                2-minute flow
              </span>
              <span className="flex items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-4 py-2.5 backdrop-blur">
                <FileCheck2 className="text-brand-500" size={16} />
                PAN + profile details
              </span>
              <span className="flex items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-4 py-2.5 backdrop-blur">
                <LockKeyhole className="text-brand-500" size={16} />
                Secure OTP verification
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="page-shell relative z-10 -mt-8 pb-14 sm:pb-20">
        <div className="mx-auto max-w-5xl">
          <Suspense fallback={<AssessmentLoading />}>
            <AssessmentForm />
          </Suspense>
          <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-6 text-slate-500">
            This is an indicative profile assessment. It does not create a bureau enquiry and is not a lender decision. Never share UPI PIN, CVV or Aadhaar OTP.
          </p>
        </div>
      </div>
    </section>
  );
}

function AssessmentLoading() {
  return (
    <div className="min-h-[760px] overflow-hidden rounded-[2rem] border border-line/80 bg-white shadow-soft" aria-label="Loading assessment" aria-busy="true">
      <div className="bg-navy-950 p-7 sm:p-9">
        <div className="skeleton skeleton-dark h-3 w-36 rounded-full" />
        <div className="skeleton skeleton-dark mt-5 h-2.5 w-full rounded-full" />
      </div>
      <div className="p-6 sm:p-10">
        <div className="skeleton h-8 w-3/5 rounded-xl" />
        <div className="skeleton mt-4 h-4 w-4/5 rounded-lg" />
        <div className="mt-9 grid gap-5 sm:grid-cols-2">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div key={item}>
              <div className="skeleton h-3 w-24 rounded-full" />
              <div className="skeleton mt-3 h-14 rounded-2xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
