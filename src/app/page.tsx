import type { Metadata } from "next";
import {
  ArrowRight,
  Banknote,
  BriefcaseBusiness,
  Building2,
  Calculator,
  Check,
  ChevronRight,
  CircleAlert,
  FileCheck2,
  GraduationCap,
  HeartHandshake,
  Home,
  Landmark,
  LockKeyhole,
  Mail,
  MessageCircle,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { EmiCalculator } from "@/components/emi-calculator";
import { HomeQuickStart } from "@/components/home/home-quick-start";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { LENDER_OUTCOME_DISCLAIMER, PLATFORM_DISCLAIMER, RESULT_DISCLAIMER, USP_GST_LABEL, USP_PRICE_LABEL, USP_TOTAL_WITH_GST_LABEL } from "@/lib/constants";

export const metadata: Metadata = {
  title: { absolute: "VP Loan Connect — Loan Match & Readiness Report" },
  description:
    "Understand your loan readiness, key eligibility factors and matched loan options through VP Loan Connect.",
  alternates: { canonical: "/" },
};

const trustItems = [
  ["Secure email verification", ShieldCheck],
  ["Transparent ₹116.82 pricing", FileCheck2],
  ["No guaranteed approvals", LockKeyhole],
  ["Official lender apply links", Landmark],
  ["Privacy-first process", Mail],
] as const;

const categories = [
  ["Personal Loan", "Explore personal-loan readiness for planned expenses.", Banknote, "/personal-loan"],
  ["Business Loan", "Explore business-loan options from stated vintage and cash flow.", BriefcaseBusiness, "/apply/quick?purpose=Business%20working%20capital"],
  ["MSME Loan", "Explore MSME-loan readiness for a growing enterprise.", Building2, "/apply/quick?purpose=Business%20working%20capital"],
  ["Home Loan", "Explore home-loan readiness before you apply with a lender.", Home, "/apply/quick?purpose=Home%20improvement"],
  ["Loan Against Property", "Explore property-backed options. This is not an approval.", Landmark, "/apply/quick"],
  ["Education Loan", "Explore education-loan readiness for fees and related costs.", GraduationCap, "/apply/quick?purpose=Education%20expense"],
  ["Working Capital", "Explore working-capital options for business cash flow.", WalletCards, "/apply/quick?purpose=Business%20working%20capital"],
] as const;

const rejectionReasons = [
  ["High EMI burden", "Existing EMIs may reduce capacity for a new repayment."],
  ["Repayment issues", "Current overdue or older settled accounts may require review."],
  ["Incomplete documents", "Missing income, banking or business proof can delay verification."],
  ["Loan amount too high", "The requested amount may be high relative to stated income."],
  ["Short work history", "A short employment or business history may weaken the profile."],
  ["Too many applications", "Several enquiries in a short period can affect the credit profile."],
] as const;

const faqs = [
  ["Does VP Loan Connect lend money?", "No. VP Loan Connect is not a bank, NBFC, lender or credit bureau. We analyse your profile, explain credit readiness and show profile-matched lender options."],
  ["Is the profile result a loan approval?", "No. It is an indicative view based on your answers. Eligibility, APR, amount and approval are decided only by the relevant lender."],
  ["Do I need to upload documents?", "Not during the initial assessment. We only ask whether documents are available. Never share a UPI PIN, CVV, bank password or Aadhaar OTP."],
  ["Will this profile check affect my CIBIL score?", "No. This assessment uses your self-reported CIBIL range; it does not pull a bureau report or create a lender enquiry."],
  ["What is the ₹116.82 payment for?", `It is the Loan Match & Readiness Report service fee: ${USP_PRICE_LABEL} + ${USP_GST_LABEL} GST. It unlocks the detailed profile, loan-readiness insights, matched loan options and official application links where available. It is not a lender processing fee and does not guarantee approval.`],
  ["How will my information be used?", "Service consent covers the requested assessment. Marketing consent is separate and optional, and can be withdrawn."],
] as const;

const journey = [
  ["01", "Tell Us Your Requirement", "Amount, purpose and contact details to open the enquiry."],
  ["02", "Verify Email", "A one-time code confirms the email on this application."],
  ["03", "Unlock Loan Matches", "₹116.82 incl. GST"],
  ["04", "Complete Profile", "Work, income, PAN and address come after payment."],
  ["05", "View Options", "See readiness insights and official application links where available."],
] as const;

export default function HomePage() {
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "VP Loan Connect",
      url: "https://www.vploanconnect.in",
      description: "Preliminary educational loan-readiness assessment based on self-reported profile information.",
      areaServed: "IN",
      provider: { "@type": "Organization", name: "VP Loan Connect", url: "https://www.vploanconnect.in" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map(([question, answer]) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <section className="hero-premium relative overflow-hidden text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="animate-pulse-soft absolute -right-24 top-10 h-[28rem] w-[28rem] rounded-full bg-brand-500/20 blur-3xl" />
          <div className="absolute -left-16 bottom-0 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
        </div>

        <div className="page-shell relative grid min-h-[820px] items-center gap-12 py-16 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16 lg:py-24">
          <div className="animate-rise relative z-10">
            <p className="text-sm font-extrabold tracking-[0.04em] text-brand-500">Loan guidance for salaried, self-employed & businesses</p>
            <h1 className="font-display mt-5 max-w-3xl text-balance text-4xl font-extrabold leading-[1.05] tracking-[-0.055em] text-white sm:text-5xl lg:text-[3.6rem]">
              Find loan options that fit your profile.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-200 sm:text-xl">
              Verify your email, unlock your loan matches, complete your profile and explore matched loan options.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/apply/quick" size="lg">
                Check My Loan Options <ArrowRight size={18} aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href="#booster" variant="glass" size="lg">
                See What {USP_TOTAL_WITH_GST_LABEL} Includes
              </ButtonLink>
            </div>
            <div className="mt-8 flex flex-wrap gap-2 text-sm text-slate-200">
              {["Secure email verification", `Transparent ${USP_TOTAL_WITH_GST_LABEL} pricing`, "No guaranteed approvals"].map((item) => (
                <span key={item} className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="animate-rise-delay relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
            <div className="animate-pulse-soft absolute -inset-8 rounded-full bg-brand-500/15 blur-3xl" />
            <HomeQuickStart />
          </div>
        </div>
      </section>

      <section aria-label="Trust and service principles" className="relative z-10 -mt-8 pb-2">
        <div className="page-shell">
          <div className="grid gap-px overflow-hidden rounded-[1.75rem] border border-line bg-line shadow-soft sm:grid-cols-2 lg:grid-cols-5">
            {trustItems.map(([label, Icon]) => (
              <div key={label} className="flex min-h-28 flex-col justify-center gap-3 bg-white px-5 py-6">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-100 text-brand-700">
                  <Icon size={19} />
                </span>
                <p className="text-sm font-bold leading-5 text-navy-950">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="section-space bg-white">
        <div className="page-shell">
          <SectionHeading
            eyebrow="How it works"
            title="A clear path from enquiry to matched options"
            description="Email verification, then unlock loan matches, then your detailed profile. The price is shown before you pay."
            align="center"
          />
          <div className="mt-12 grid gap-4 md:grid-cols-5">
            {journey.map(([number, title, description]) => (
              <article key={number} className="rounded-[1.5rem] border border-line bg-surface p-5">
                <span className="font-display text-sm font-black text-brand-600">{number}</span>
                <h3 className="font-display mt-3 text-base font-extrabold tracking-[-0.02em] text-navy-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="loan-options" className="section-space surface-grid bg-surface">
        <div className="page-shell">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <SectionHeading
              eyebrow="Profile matching"
              title="Explore categories aligned with your profile"
              description="These are profile-based suggestions—not lender offers, approvals or guaranteed eligibility."
            />
              <ButtonLink href="/apply/quick" variant="secondary">
                Check My Loan Options <ArrowRight size={17} />
              </ButtonLink>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map(([title, description, Icon, href]) => (
              <a
                key={title}
                href={href}
                className="group rounded-[1.5rem] border border-line/80 bg-white p-6 transition duration-300 hover:-translate-y-1 hover:border-brand-500/35 hover:shadow-card"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-100 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">
                  <Icon size={22} />
                </span>
                <h3 className="font-display mt-6 text-lg font-extrabold tracking-[-0.02em] text-navy-950">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
                <p className="mt-4 text-xs font-bold text-brand-700">
                  Explore {title} readiness <ChevronRight className="inline" size={14} />
                </p>
              </a>
            ))}
            <article className="flex min-h-64 flex-col justify-between rounded-[1.5rem] bg-navy-950 p-7 text-white sm:col-span-2 lg:col-span-1">
              <div>
                <Landmark className="text-brand-500" size={28} />
                <h3 className="font-display mt-6 text-xl font-extrabold tracking-[-0.02em]">Not sure where to begin?</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">The assessment compares your profile with common eligibility factors.</p>
              </div>
              <ButtonLink href="/apply/quick" className="mt-6 w-full">
                Check My Loan Options
              </ButtonLink>
            </article>
          </div>
        </div>
      </section>

      <section id="benefits" className="section-space bg-white">
        <div className="page-shell grid items-start gap-14 lg:grid-cols-2">
          <div>
            <SectionHeading
              eyebrow="Common application gaps"
              title="Why a loan application may be declined"
              description="Every lender has a different policy. These common gaps can weaken an application."
            />
            <div className="mt-9 grid gap-3 sm:grid-cols-2">
              {rejectionReasons.map(([title, description]) => (
                <div key={title} className="rounded-2xl bg-surface p-5">
                  <div className="flex items-center gap-3">
                    <CircleAlert className="shrink-0 text-amber-600" size={18} />
                    <h3 className="font-display font-extrabold text-navy-950">{title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative overflow-hidden rounded-[2rem] bg-navy-950 p-8 text-white shadow-soft sm:p-10">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-500/20 blur-3xl" />
            <span className="relative inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white">
              <ShieldCheck size={16} className="text-brand-500" />
              Guidance before applications
            </span>
            <h2 className="font-display relative mt-7 text-balance text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">
              Do not apply everywhere at once
            </h2>
            <div className="relative mt-8 grid gap-6">
              <Benefit title="Estimate a sensible EMI" description="Understand a comfortable EMI before choosing a tenure." />
              <Benefit title="Prepare documents first" description="Identify missing proofs without uploading them." />
              <Benefit title="Choose the right category" description="Understand whether an unsecured or secured route may fit better." />
              <Benefit title="Reduce unnecessary applications" description="Address profile gaps before applying everywhere." />
            </div>
          </div>
        </div>
      </section>

      <section id="emi-calculator" className="section-space surface-grid bg-surface">
        <div className="page-shell grid items-start gap-12 lg:grid-cols-[0.72fr_1.28fr]">
          <div className="lg:sticky lg:top-28">
            <SectionHeading
              eyebrow="Repayment planning"
              title="Estimate your monthly EMI"
              description="Adjust amount, annual rate and tenure to estimate EMI. This is not a lender quote."
            />
            <div className="mt-7 flex items-start gap-3 rounded-2xl border border-line bg-white p-5 text-sm leading-7 text-slate-600">
              <Calculator className="mt-1 shrink-0 text-brand-700" size={20} />
              Actual rates, fees, insurance, taxes and eligibility vary by lender.
            </div>
          </div>
          <EmiCalculator />
        </div>
      </section>

      <section id="booster" className="section-space bg-white">
        <div className="page-shell grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <SectionHeading
              eyebrow="Loan readiness"
              title="Loan Match & Readiness Report"
              description="Get a clearer view of your loan readiness, important eligibility factors and matched loan options based on your completed profile."
            />
            <ul className="mt-8 grid gap-3 text-sm font-semibold text-navy-950">
              {["Detailed profile assessment", "Loan-readiness insights", "Matched loan categories and options", "Official apply links where available", "Profile improvement guidance"].map((item) => (
                <li key={item} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
                  <Check className="text-brand-600" size={16} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[1.75rem] bg-navy-950 p-8 text-white">
            <p className="text-sm text-slate-300">Service fee {USP_PRICE_LABEL}</p>
            <p className="text-sm text-slate-300">GST (18%) {USP_GST_LABEL}</p>
            <p className="mt-3 text-4xl font-black">Total: {USP_TOTAL_WITH_GST_LABEL}</p>
            <ButtonLink href="/apply/quick" size="lg" className="mt-8 w-full">
              Unlock My Loan Matches — {USP_TOTAL_WITH_GST_LABEL} <ArrowRight size={18} />
            </ButtonLink>
            <p className="mt-4 text-xs leading-6 text-slate-300">{LENDER_OUTCOME_DISCLAIMER}</p>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-navy-950 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(25,183,126,0.18),transparent_45%)]" />
        <div className="page-shell relative grid items-center gap-10 py-16 lg:grid-cols-[1fr_auto] sm:py-20">
          <div className="max-w-3xl">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-500">VP Refer & Earn</p>
            <h2 className="font-display mt-4 text-balance text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">Share a clearer loan check</h2>
            <p className="mt-5 max-w-2xl leading-8 text-slate-300">
              Rewards apply only to valid, non-refunded plan purchases—not clicks, registrations or loan approvals.
            </p>
          </div>
          <ButtonLink href="/refer" variant="glass" size="lg">
            <HeartHandshake size={19} />
            Explore Refer & Earn
          </ButtonLink>
        </div>
      </section>

      <section id="faq" className="section-space bg-white">
        <div className="page-shell grid gap-12 lg:grid-cols-[0.68fr_1.32fr]">
          <div>
            <SectionHeading
              eyebrow="Frequently asked questions"
              title="Clear answers for better decisions"
              description="The ₹116.82 payment is the Loan Match & Readiness Report service fee. It is not a lender processing fee, and approval is never guaranteed."
            />
            <ButtonLink href="/contact" variant="secondary" className="mt-7">
              <MessageCircle size={18} />
              Contact support
            </ButtonLink>
          </div>
          <div className="grid gap-3">
            {faqs.map(([question, answer]) => (
              <details key={question} className="group rounded-2xl border border-line bg-white p-5 transition open:border-brand-500/40 open:shadow-card sm:p-6">
                <summary className="font-display flex min-h-11 cursor-pointer list-none items-center justify-between gap-5 font-extrabold text-navy-950 marker:hidden">
                  {question}
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface text-brand-700 transition group-open:rotate-90">
                    <ChevronRight size={17} />
                  </span>
                </summary>
                <p className="mt-4 max-w-3xl pr-8 text-sm leading-7 text-slate-600">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-surface py-10">
        <div className="page-shell">
          <div className="flex items-start gap-4 rounded-[1.5rem] border border-line bg-white p-6 sm:p-8">
            <LockKeyhole className="mt-1 shrink-0 text-brand-700" size={23} />
            <div>
              <h2 className="font-display font-extrabold text-navy-950">Important information</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                {RESULT_DISCLAIMER} {PLATFORM_DISCLAIMER}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-space bg-white">
        <div className="page-shell">
          <div className="relative overflow-hidden rounded-[2rem] bg-navy-950 p-8 text-white sm:p-12 lg:p-16">
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand-500/25 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
            <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_auto]">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-500">Start with accurate information</p>
                <h2 className="font-display mt-4 text-balance text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl lg:text-5xl">
                Ready to check loan options for your profile?
                </h2>
                <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
                  Verify your email, unlock your loan matches for {USP_TOTAL_WITH_GST_LABEL}, then complete your profile and explore matched options.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/apply/quick" size="lg">
                  Check My Loan Options <ArrowRight size={18} />
                </ButtonLink>
                <ButtonLink href="/credit-health" variant="glass" size="lg">
                  What {USP_TOTAL_WITH_GST_LABEL} includes
                </ButtonLink>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Benefit({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex gap-4">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-500 text-navy-950">
        <Check size={15} strokeWidth={3} />
      </span>
      <div>
        <h3 className="font-display font-extrabold">{title}</h3>
        <p className="mt-1.5 text-sm leading-6 text-slate-300">{description}</p>
      </div>
    </div>
  );
}
