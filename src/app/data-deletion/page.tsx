import type { Metadata } from "next";
import { DataDeletionForm } from "@/components/data-deletion-form";
import { PolicyPage } from "@/components/legal/policy-page";

export const metadata: Metadata = {
  title: "Data Deletion Request",
  description: "Request deletion or de-identification of your VP Loan Connect profile data after mobile SMS OTP verification.",
  alternates: { canonical: "/data-deletion" },
};

export default function DataDeletionPage() {
  return (
    <>
      <PolicyPage
        title="Data Deletion Request"
        summary="Use the verified-mobile workflow below to request deletion or de-identification of your personal profile data."
        sections={[
          { title: "Before deletion", paragraphs: ["We verify control of the registered mobile number to reduce unauthorized deletion. We may contact you for clarification through the service channel."] },
          { title: "What may be retained", paragraphs: ["Payment, refund, fraud-prevention, consent withdrawal and audit records may be retained or de-identified where required for legal, accounting or dispute obligations."] },
          { title: "Processing", paragraphs: ["A request moves through requested, verifying, processing and completed states. Deletion is not treated as immediate until operational and legal checks are complete."] },
        ]}
      />
      <section className="surface-grid bg-surface pb-18">
        <div className="page-shell">
          <div className="mx-auto max-w-5xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-700">Verified request</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.045em] text-navy-950">Submit your deletion request</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">Verify the registered mobile number, then provide any optional processing context.</p>
            <DataDeletionForm />
          </div>
        </div>
      </section>
    </>
  );
}
