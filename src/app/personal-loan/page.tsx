import type { Metadata } from "next";
import {
  ArrowRight,
  BadgeCheck,
  Calculator,
  Check,
  CircleAlert,
  Clock3,
  FileCheck2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { EmiCalculator } from "@/components/emi-calculator";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { PLATFORM_DISCLAIMER, RESULT_DISCLAIMER } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Personal Loan Profile Check",
  description:
    "Free personal-loan profile check, then optional ₹99 Credit Profile Booster for profile-matched loan options.",
  alternates: { canonical: "/personal-loan" },
  openGraph: {
    title: "Personal Loan Profile Check | VP Loan Connect",
    description: "Free readiness check + ₹99 Credit Profile Booster. Profile-matched options first.",
    url: "/personal-loan",
  },
};

const benefits = [
  ["Collateral-free profile review", "Understand unsecured personal-loan readiness without uploading documents first."],
  ["Clear next-step guidance", "See EMI capacity, document gaps and matched official platform options."],
  ["OTP-secured result", "Verify your contact details before the free indicative result is unlocked."],
  ["Apply only when ready", "We do not auto-submit your data. Every lender application stays voluntary."],
] as const;

const steps = [
  ["01", "Share your need", "Choose amount, purpose and basic contact details."],
  ["02", "Verify securely", "Complete OTP verification for a protected result link."],
  ["03", "Answer profile questions", "Income, existing EMIs, CIBIL range and document readiness."],
  ["04", "View free result", "See indicative readiness before the optional ₹99 Credit Profile Booster."],
  ["05", "Best-fit official platforms", "Open profile-ranked lender or LSP journeys only if you choose."],
] as const;

const quickAmounts = [
  { label: "₹10,000", href: "/assessment?loanType=PERSONAL&amount=10000&purpose=Other%20personal%20need" },
  { label: "₹25,000", href: "/assessment?loanType=PERSONAL&amount=25000&purpose=Other%20personal%20need" },
  { label: "₹50,000", href: "/assessment?loanType=PERSONAL&amount=50000&purpose=Other%20personal%20need" },
  { label: "₹1,00,000", href: "/assessment?loanType=PERSONAL&amount=100000&purpose=Other%20personal%20need" },
  { label: "₹2,00,000", href: "/assessment?loanType=PERSONAL&amount=200000&purpose=Other%20personal%20need" },
  { label: "₹5,00,000", href: "/assessment?loanType=PERSONAL&amount=500000&purpose=Other%20personal%20need" },
] as const;

export default function PersonalLoanPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "VP Loan Connect Personal Loan Profile Check",
    url: "https://www.vploanconnect.in/personal-loan",
    description: "Preliminary personal-loan readiness assessment based on self-reported profile information.",
    areaServed: "IN",
    provider: { "@type": "Organization", name: "VP Loan Connect", url: "https://www.vploanconnect.in" },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <section className="hero-premium relative overflow-hidden text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="animate-pulse-soft absolute -right-24 top-10 h-[26rem] w-[26rem] rounded-full bg-brand-500/20 blur-3xl" />
        </div>
        <div className="page-shell relative grid min-h-[780px] items-center gap-14 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
          <div className="animate-rise relative z-10">
            <p className="font-display text-sm font-extrabold tracking-[0.28em] text-brand-500">VP LOAN CONNECT</p>
            <p className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">
              Personal loan readiness · ₹5,000 to ₹5,00,000
            </p>
            <h1 className="font-display mt-5 max-w-3xl text-balance text-4xl font-extrabold leading-[1.05] tracking-[-0.055em] sm:text-5xl lg:text-[3.7rem]">
              Quick personal-loan check
              <span className="mt-2 block text-brand-500">before you apply</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300 sm:text-xl">
              Amount चुनो, income और CIBIL range बताओ — free indicative eligibility, bina document upload ya bank password.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/assessment?loanType=PERSONAL&purpose=Other%20personal%20need" size="lg">
                Check Personal Loan Options <ArrowRight size={18} aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href="#emi-planner" variant="glass" size="lg">
                <Calculator size={18} aria-hidden="true" /> Estimate EMI
              </ButtonLink>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate-300">
              <span className="flex items-center gap-2"><Clock3 className="text-brand-500" size={17} />Free indicative result</span>
              <span className="flex items-center gap-2"><FileCheck2 className="text-brand-500" size={17} />No document upload</span>
              <span className="flex items-center gap-2"><LockKeyhole className="text-brand-500" size={17} />Secure OTP verification</span>
            </div>
          </div>

          <div className="animate-rise-delay relative mx-auto w-full max-w-md lg:mx-0">
            <div className="animate-pulse-soft absolute -inset-8 rounded-full bg-brand-500/15 blur-3xl" />
            <div className="premium-panel relative overflow-hidden rounded-[2rem] p-3">
              <div className="rounded-[1.6rem] bg-white p-6 text-navy-950 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-brand-100 px-3 py-1.5 text-xs font-extrabold text-brand-700">
                    <Sparkles size={13} />
                    Start check
                  </span>
                  <span className="text-xs font-bold text-slate-500">Partner-ready</span>
                </div>
                <h2 className="font-display mt-5 text-2xl font-extrabold tracking-[-0.035em]">How much do you need?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">Pick an amount to open the assessment with personal loan pre-selected.</p>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {quickAmounts.map((item) => (
                    <ButtonLink key={item.label} href={item.href} variant="secondary" size="sm" className="justify-center px-2 text-xs sm:text-sm">
                      {item.label}
                    </ButtonLink>
                  ))}
                </div>
                <ButtonLink href="/assessment?loanType=PERSONAL&purpose=Other%20personal%20need" className="mt-5 w-full" size="lg">
                  Continue to profile check
                </ButtonLink>
                <p className="mt-4 text-xs leading-5 text-slate-500">
                  Submitting the assessment does not guarantee approval. Final decision rests with the regulated lender.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-space bg-white">
        <div className="page-shell">
          <SectionHeading
            eyebrow="Why check first"
            title="Personal-loan journey that stays clear and voluntary"
            description="Structured like a modern lender landing—minus fake urgency. Profile first, application second."
            align="center"
          />
          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {benefits.map(([title, description]) => (
              <article key={title} className="rounded-3xl border border-line/80 bg-surface p-6">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-100 text-brand-700"><Check size={20} /></span>
                <h3 className="mt-5 text-lg font-extrabold text-navy-950">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-space surface-grid bg-surface">
        <div className="page-shell grid items-start gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <SectionHeading
              eyebrow="Indicative market ranges"
              title="Understand typical personal-loan costs"
              description="These are educational ranges commonly seen on digital personal-loan journeys. They are not VP Loan Connect offers or quotes."
            />
            <div className="mt-7 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-950">
              <CircleAlert className="mt-0.5 shrink-0" size={18} />
              Actual APR, fees, insurance, tenure and eligibility are decided only by the lender after verification. Always read the Key Fact Statement.
            </div>
          </div>
          <div className="overflow-hidden rounded-[2rem] border border-line/80 bg-white shadow-soft">
            <dl className="divide-y divide-line">
              <RateRow label="Typical amount band shown on this journey" value="₹5,000 – ₹5,00,000" />
              <RateRow label="Common digital tenure band" value="12 – 60 months" />
              <RateRow label="Indicative interest range (market)" value="About 12% – 36% p.a." />
              <RateRow label="Processing / tech charges (market)" value="Often 1% – 3% + taxes" />
              <RateRow label="What VP Loan Connect charges for the free check" value="₹0 for indicative result" />
            </dl>
            <div className="border-t border-line bg-navy-950 p-6 text-white sm:p-7">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-500">Example EMI (estimate only)</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                ₹1,00,000 at 18% p.a. for 12 months ≈ <strong className="text-white">₹9,168 / month</strong> using reducing-balance maths before lender fees.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="emi-planner" className="section-space bg-white">
        <div className="page-shell grid items-start gap-12 lg:grid-cols-[0.72fr_1.28fr]">
          <div className="lg:sticky lg:top-28">
            <SectionHeading
              eyebrow="Repayment planning"
              title="Calculate your EMI within minutes"
              description="Adjust amount, rate and tenure. This is a planning tool—not a lender sanction."
            />
            <div className="mt-7 space-y-3 text-sm leading-7 text-slate-600">
              <p className="flex items-start gap-2"><ShieldCheck className="mt-1 shrink-0 text-brand-700" size={18} />No bureau pull during this calculator use.</p>
              <p className="flex items-start gap-2"><WalletCards className="mt-1 shrink-0 text-brand-700" size={18} />Keep EMI comfortable versus monthly income before applying.</p>
            </div>
          </div>
          <EmiCalculator initialPrincipal={100000} initialRate={18} initialMonths={12} />
        </div>
      </section>

      <section className="section-space surface-grid bg-surface">
        <div className="page-shell">
          <SectionHeading eyebrow="Simple process" title="Five steps to a clearer personal-loan decision" align="center" />
          <div className="mt-12 grid gap-4 md:grid-cols-5">
            {steps.map(([number, title, description]) => (
              <article key={number} className="rounded-3xl border border-line/80 bg-white p-5 shadow-sm">
                <span className="text-sm font-black text-brand-600">{number}</span>
                <h3 className="mt-3 text-base font-extrabold text-navy-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-space bg-white">
        <div className="page-shell grid gap-5 lg:grid-cols-3">
          <div className="rounded-3xl border border-line bg-surface p-7 lg:col-span-2">
            <BadgeCheck className="text-brand-700" size={28} />
            <h2 className="mt-5 text-2xl font-extrabold tracking-[-0.035em] text-navy-950">Partnership / campaign deep links</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              This page accepts partner tracking parameters such as <code className="rounded bg-white px-1.5 py-0.5 text-xs">utm_source</code>,{" "}
              <code className="rounded bg-white px-1.5 py-0.5 text-xs">utm_campaign</code>, <code className="rounded bg-white px-1.5 py-0.5 text-xs">pid</code>,{" "}
              <code className="rounded bg-white px-1.5 py-0.5 text-xs">c</code> and AppsFlyer-style keys. They are stored for the session, saved with the lead, and appended when users continue to official platforms.
            </p>
            <p className="mt-4 rounded-2xl bg-white p-4 text-xs leading-6 text-slate-500">
              Example: <span className="break-all font-medium text-navy-900">/personal-loan?utm_source=partnership&amp;pid=YourPartner_PA&amp;utm_campaign=pl_launch</span>
            </p>
          </div>
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-7">
            <CircleAlert className="text-amber-700" size={28} />
            <h2 className="mt-5 text-xl font-extrabold text-amber-950">Important</h2>
            <p className="mt-3 text-sm leading-7 text-amber-950">{RESULT_DISCLAIMER}</p>
            <p className="mt-3 text-sm leading-7 text-amber-950">{PLATFORM_DISCLAIMER}</p>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-navy-950 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_0%,rgba(25,183,126,0.18),transparent_45%)]" />
        <div className="page-shell relative flex flex-col items-start justify-between gap-8 py-16 lg:flex-row lg:items-center sm:py-20">
          <div className="max-w-2xl">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-500">Ready when you are</p>
            <h2 className="font-display mt-4 text-balance text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">
              Personal loan options that fit your profile
            </h2>
            <p className="mt-4 text-base leading-8 text-slate-300">
              Start with accurate information. No false approval promise and no pressure to pay before the free result.
            </p>
          </div>
          <ButtonLink href="/assessment?loanType=PERSONAL&purpose=Other%20personal%20need" size="lg">
            Start Free Personal Loan Check <ArrowRight size={18} />
          </ButtonLink>
        </div>
      </section>
    </>
  );
}

function RateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <dt className="text-sm font-semibold text-slate-600">{label}</dt>
      <dd className="text-sm font-extrabold text-navy-950 sm:text-right">{value}</dd>
    </div>
  );
}
