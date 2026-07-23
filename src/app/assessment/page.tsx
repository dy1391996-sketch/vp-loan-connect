import type { Metadata } from "next";
import { Suspense } from "react";
import { AssessmentForm } from "@/components/assessment/assessment-form";

export const metadata: Metadata = { title: "Free Loan Options Assessment", description: "Complete a consent-based, OTP-verified preliminary loan-readiness assessment." };

export default function AssessmentPage() {
  return (
    <section className="min-h-screen bg-surface py-10 sm:py-16">
      <div className="page-shell">
        <div className="mx-auto max-w-4xl">
          <div className="mb-7 text-center"><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Free preliminary assessment</p><h1 className="mt-3 text-balance text-3xl font-bold tracking-[-0.04em] text-navy-950 sm:text-4xl">अपनी loan readiness step-by-step check करें</h1><p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-600">Sensitive documents upload न करें। हम UPI PIN, CVV, bank password या Aadhaar OTP कभी नहीं मांगते.</p></div>
          <Suspense fallback={<div className="min-h-[520px] animate-pulse rounded-3xl border border-line bg-white shadow-soft" aria-label="Loading assessment" />}>
            <AssessmentForm />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
