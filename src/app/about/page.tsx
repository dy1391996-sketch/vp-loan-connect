import type { Metadata } from "next";
import Link from "next/link";
import { Building2, FileText, ShieldCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import {
  PLATFORM_DISCLAIMER,
  PUBLIC_SUPPORT_EMAIL,
  USP_PRICE_LABEL,
  USP_PRODUCT_NAME,
  USP_TOTAL_WITH_GST_LABEL,
} from "@/lib/constants";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Learn about VP Loan Connect — a profile assessment and loan-discovery platform. We are not a bank, NBFC or direct lender.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <section className="surface-grid min-h-[75vh] bg-surface py-14 sm:py-20">
      <div className="page-shell">
        <div className="mx-auto max-w-5xl">
          <div className="max-w-3xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-700">About Us</p>
            <h1 className="mt-4 text-balance text-4xl font-extrabold tracking-[-0.05em] text-navy-950 sm:text-5xl">
              VP Loan Connect
            </h1>
            <p className="mt-5 text-base leading-8 text-slate-600">
              VP Loan Connect helps people understand their credit profile and loan readiness, then discover
              profile-matched official lender options. We sell educational assessment reports and related
              assistance services — not loans.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            <InfoCard
              icon={ShieldCheck}
              title="Who we are"
              body="A financial-information, profile-assessment and loan-discovery platform operating at www.vploanconnect.in."
            />
            <InfoCard
              icon={FileText}
              title="What customers pay for"
              body={`${USP_PRICE_LABEL} + GST (${USP_TOTAL_WITH_GST_LABEL}) ${USP_PRODUCT_NAME} report fee, plus optional consultation or assisted application support where offered.`}
            />
            <InfoCard
              icon={Building2}
              title="What we are not"
              body="Not a bank, NBFC, direct lender or credit bureau. We do not sanction loans, collect loan repayments or guarantee approval."
            />
          </div>

          <div className="mt-8 rounded-[2rem] border border-line bg-white p-7 shadow-sm sm:p-9">
            <h2 className="text-2xl font-extrabold tracking-[-0.035em] text-navy-950">Our services</h2>
            <ul className="mt-5 grid gap-3 text-sm leading-7 text-slate-600">
              <li>Free profile assessment to explain credit-readiness indicators from the information you provide.</li>
              <li>
                Paid {USP_PRODUCT_NAME} ({USP_PRICE_LABEL} + GST) with profile analysis and matched official partner apply
                links.
              </li>
              <li>Optional consultation / assisted application guidance — educational support only.</li>
            </ul>
            <p className="mt-6 text-sm leading-7 text-slate-600">{PLATFORM_DISCLAIMER}</p>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Payments on this website are service / report fees only. They are never loan repayments, loan disbursements,
              or fees paid for guaranteed loan approval.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <ButtonLink href="/assessment" size="lg">
              Start free assessment
            </ButtonLink>
            <ButtonLink href="/contact" variant="secondary" size="lg">
              Contact support
            </ButtonLink>
          </div>
          <p className="mt-6 text-sm text-slate-500">
            Email{" "}
            <a className="font-bold text-brand-700" href={`mailto:${PUBLIC_SUPPORT_EMAIL}`}>
              {PUBLIC_SUPPORT_EMAIL}
            </a>
            {" · "}
            <Link href="/privacy" className="font-semibold text-navy-900 underline-offset-4 hover:underline">
              Privacy
            </Link>
            {" · "}
            <Link href="/terms" className="font-semibold text-navy-900 underline-offset-4 hover:underline">
              Terms
            </Link>
            {" · "}
            <Link href="/refund-policy" className="font-semibold text-navy-900 underline-offset-4 hover:underline">
              Refunds
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

function InfoCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof ShieldCheck;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-3xl border border-line bg-white p-6 shadow-card">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-100 text-brand-700">
        <Icon size={21} />
      </span>
      <h2 className="mt-6 text-lg font-extrabold text-navy-950">{title}</h2>
      <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
    </div>
  );
}
