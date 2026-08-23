import type { Metadata } from "next";
import { Suspense } from "react";
import { Clock3, FileCheck2, LockKeyhole, Sparkles } from "lucide-react";
import { AssessmentForm } from "@/components/assessment/assessment-form";
import { USP_PRICE_LABEL, USP_PRODUCT_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Apply — Verify, eligibility, address, unlock",
  description: `Complete a short profile (email OTP, PAN, income, address) then unlock ${USP_PRODUCT_NAME} for ${USP_PRICE_LABEL} + GST with official lender/LSP apply links.`,
  alternates: { canonical: "/assessment" },
};

export default function AssessmentPage() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-surface">
      <div className="hero-premium relative overflow-hidden text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="animate-pulse-soft absolute -right-20 top-0 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" />
        </div>
        <div className="page-shell relative py-10 sm:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-display text-sm font-extrabold tracking-[0.28em] text-brand-500">VP LOAN CONNECT</p>
            <p className="mt-4 inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">
              <Sparkles size={14} className="text-brand-500" />
              4-step apply · Mobile-first
            </p>
            <h1 className="font-display mt-4 text-balance text-3xl font-extrabold tracking-[-0.05em] sm:text-5xl">
              Verify. Check eligibility.
              <span className="mt-2 block text-brand-500">Unlock matched options.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              OTP verification, PAN & income, address, then honest {USP_PRICE_LABEL} {USP_PRODUCT_NAME}. We never ask for bank KYC or Aadhaar OTP.
            </p>
            <div className="mx-auto mt-7 flex max-w-3xl flex-wrap justify-center gap-3 text-xs font-bold text-slate-300">
              <span className="flex items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-4 py-2.5 backdrop-blur">
                <Clock3 className="text-brand-500" size={16} />
                ~2 minutes
              </span>
              <span className="flex items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-4 py-2.5 backdrop-blur">
                <FileCheck2 className="text-brand-500" size={16} />
                PAN + income
              </span>
              <span className="flex items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-4 py-2.5 backdrop-blur">
                <LockKeyhole className="text-brand-500" size={16} />
                OTP · secure
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="page-shell relative z-10 -mt-6 pb-14 sm:pb-20">
        <div className="mx-auto max-w-3xl">
          <Suspense fallback={<AssessmentLoading />}>
            <AssessmentForm />
          </Suspense>
          <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-6 text-slate-500">
            {USP_PRICE_LABEL} is for Credit Profile Booster analysis and matched official apply links — not a lender processing fee or approval guarantee. Never share UPI PIN, CVV or Aadhaar OTP.
          </p>
        </div>
      </div>
    </section>
  );
}

function AssessmentLoading() {
  return (
    <div className="min-h-[640px] overflow-hidden rounded-[1.75rem] border border-line/80 bg-white shadow-soft" aria-label="Loading assessment" aria-busy="true">
      <div className="border-b border-line bg-surface p-5 sm:px-8">
        <div className="skeleton h-8 w-full rounded-full" />
      </div>
      <div className="p-6 sm:p-10">
        <div className="skeleton mx-auto h-12 w-12 rounded-full" />
        <div className="skeleton mx-auto mt-5 h-8 w-3/5 rounded-xl" />
        <div className="skeleton mx-auto mt-4 h-4 w-4/5 rounded-lg" />
        <div className="mt-9 grid gap-5">
          {[0, 1, 2].map((item) => (
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
