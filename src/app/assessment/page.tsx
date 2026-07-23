import type { Metadata } from "next";
import { Suspense } from "react";
import { Clock3, FileCheck2, LockKeyhole } from "lucide-react";
import { AssessmentForm } from "@/components/assessment/assessment-form";

export const metadata: Metadata = { title: "Free Loan Readiness Assessment", description: "Complete a secure, consent-based and OTP-verified preliminary loan-readiness assessment in about two minutes." };

export default function AssessmentPage() {
  return (
    <section className="surface-grid min-h-screen bg-surface py-10 sm:py-16">
      <div className="page-shell">
        <div className="mx-auto max-w-5xl">
          <div className="mb-9 text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-700">Free preliminary assessment</p>
            <h1 className="mt-4 text-balance text-3xl font-extrabold tracking-[-0.045em] text-navy-950 sm:text-5xl">अपनी Loan Readiness step-by-step check करें</h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-slate-600">Answer simple profile questions to receive a useful educational preview. No sensitive document upload is needed.</p>
            <div className="mx-auto mt-7 flex max-w-3xl flex-wrap justify-center gap-3 text-xs font-bold text-slate-600">
              <span className="flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5"><Clock3 className="text-brand-700" size={16} />About 2 minutes</span>
              <span className="flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5"><FileCheck2 className="text-brand-700" size={16} />No document upload</span>
              <span className="flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5"><LockKeyhole className="text-brand-700" size={16} />Consent protected</span>
            </div>
          </div>
          <Suspense fallback={<AssessmentLoading />}>
            <AssessmentForm />
          </Suspense>
          <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-6 text-slate-500">This assessment is educational and does not trigger a bureau enquiry or represent a lender decision.</p>
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
          {[0, 1, 2, 3, 4, 5].map((item) => <div key={item}><div className="skeleton h-3 w-24 rounded-full" /><div className="skeleton mt-3 h-14 rounded-2xl" /></div>)}
        </div>
      </div>
    </div>
  );
}
