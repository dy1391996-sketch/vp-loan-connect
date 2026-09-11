import type { Metadata } from "next";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  BriefcaseBusiness,
  Building2,
  Calculator,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileCheck2,
  Gem,
  GraduationCap,
  HandCoins,
  HeartHandshake,
  Home,
  Landmark,
  LockKeyhole,
  MessageCircle,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  WalletCards,
} from "lucide-react";
import { EmiCalculator } from "@/components/emi-calculator";
import { HomeQuickStart } from "@/components/home/home-quick-start";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { PLATFORM_DISCLAIMER, RESULT_DISCLAIMER, USP_TOTAL_WITH_GST_LABEL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Find Loan Options for Your Profile | VP Loan Connect",
  description:
    "Check loan options for your profile in minutes. Verify email, unlock the ₹99 Credit Profile Booster, then complete PAN and profile details. Not a lender — no guaranteed approval.",
  alternates: { canonical: "/" },
};

const trustItems = [
  ["Free profile check", ShieldCheck],
  ["₹99 Credit Profile Booster", Sparkles],
  ["Matched lenders first", SearchCheck],
  ["No docs in free check", FileCheck2],
  ["Privacy-first", LockKeyhole],
  ["Official apply links", Landmark],
] as const;

const categories = [
  ["Personal Loan", "Review personal-loan readiness based on income and existing EMIs.", Banknote, "/personal-loan"],
  ["Business Loan", "Review business vintage, cash flow and document readiness.", BriefcaseBusiness, "/assessment?loanType=BUSINESS"],
  ["MSME Loan", "Understand the profile factors relevant to growing businesses.", Building2, "/assessment?loanType=BUSINESS"],
  ["Gold Loan", "Explore secured-loan readiness when eligible gold is available.", Gem, "/assessment?loanType=GOLD"],
  ["Loan Against Property", "Review readiness for a property-backed loan route.", Home, "/assessment?loanType=PROPERTY"],
  ["Education Loan", "Prepare income, co-applicant and education documents.", GraduationCap, "/assessment?loanType=PERSONAL&purpose=Education%20expense"],
  ["Working Capital", "Understand business working-capital readiness.", WalletCards, "/assessment?loanType=BUSINESS&purpose=Business%20working%20capital"],
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
  ["Is the free result a loan approval?", "No. It is an indicative view based on your answers. Eligibility, APR, amount and approval are decided only by the relevant lender."],
  ["Do I need to upload documents?", "Not during the initial assessment. We only ask whether documents are available. Never share a UPI PIN, CVV, bank password or Aadhaar OTP."],
  ["Will this profile check affect my CIBIL score?", "No. This assessment uses your self-reported CIBIL range; it does not pull a bureau report or create a lender enquiry."],
  ["Is the ₹99 Credit Profile Booster mandatory?", "Matched official apply links and the full Credit Profile Booster require ₹99 + GST. We are not a lender and do not charge a % platform fee on your loan amount."],
  ["How will my information be used?", "Service consent covers the requested assessment. Marketing consent is separate and optional, and can be withdrawn."],
] as const;

const journey = [
  ["01", "Quick start", "Tell us the amount you need, or start from Quick Apply."],
  ["02", "Email OTP", "Verify your email before checkout."],
  ["03", "₹116.82 unlock", "Credit Profile Booster checkout — same ₹99 + GST fee."],
  ["04", "Detailed profile", "Work, income, PAN, address and consent after payment."],
  ["05", "View your options", "See the preliminary result and matched loan categories."],
  ["06", "Official apply", "Continue only on the partner’s official flow if you choose."],
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
            <p className="font-display text-sm font-extrabold tracking-[0.28em] text-brand-500">VP LOAN CONNECT</p>
            <h1 className="font-display mt-6 max-w-3xl text-balance text-4xl font-extrabold leading-[1.05] tracking-[-0.055em] sm:text-5xl lg:text-[3.9rem]">
              Find loan options
              <span className="mt-2 block text-brand-500">for your profile.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300 sm:text-xl">
              Check what may fit your amount, income and credit picture — then unlock matched official lender links with the Credit Profile Booster. We are not a lender and do not approve or disburse loans.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/apply/quick" size="lg">
                Check My Loan Options <ArrowRight size={18} aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href="/credit-health" variant="glass" size="lg">
                What {USP_TOTAL_WITH_GST_LABEL} includes
              </ButtonLink>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate-300">
              <span className="flex items-center gap-2">
                <Clock3 className="text-brand-500" size={17} />
                Email OTP, then a short check
              </span>
              <span className="flex items-center gap-2">
                <FileCheck2 className="text-brand-500" size={17} />
                Existing {USP_TOTAL_WITH_GST_LABEL} booster
              </span>
              <span className="flex items-center gap-2">
                <LockKeyhole className="text-brand-500" size={17} />
                No guaranteed approval
              </span>
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
          <div className="grid gap-px overflow-hidden rounded-[1.75rem] border border-line bg-line shadow-soft sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
            eyebrow="Simple, premium process"
            title="See options. Unlock matches when useful."
            description="A clear journey: verify email, unlock Credit Profile Booster, then finish the detailed profile. No percentage platform fee on your loan amount."
            align="center"
          />
          <div className="mt-16 grid gap-5 md:grid-cols-3">
            <ProcessCard number="01" icon={UserRoundCheck} title="Start + email OTP" description="Amount, purpose, name and email — then verify before checkout." />
            <ProcessCard number="02" icon={HandCoins} title={`Pay ${USP_TOTAL_WITH_GST_LABEL} Booster`} description="Same Credit Profile Booster checkout — not a lender processing fee." />
            <ProcessCard number="03" icon={ChartNoAxesCombined} title="Finish profile + options" description="PAN and work details come after payment, then matched official apply links." />
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
                  Explore {title} <ChevronRight className="inline" size={14} />
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
            <span className="relative inline-flex items-center gap-2 rounded-xl bg-brand-500/12 px-4 py-2 text-xs font-bold text-brand-100">
              <BadgeCheck size={16} />
              Profile first. Application second.
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

      <section className="section-space bg-white">
        <div className="page-shell">
          <SectionHeading
            eyebrow="The complete journey"
            title="No pressure—every step remains your choice"
            description="Start with the free assessment and continue only when it helps."
            align="center"
          />
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {journey.map(([number, title, description]) => (
              <div key={number} className="relative rounded-[1.5rem] border border-line bg-white p-6 transition hover:border-brand-500/30">
                <span className="font-display text-sm font-black text-brand-600">{number}</span>
                <h3 className="font-display mt-4 text-lg font-extrabold tracking-[-0.02em] text-navy-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-navy-950 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(25,183,126,0.18),transparent_45%)]" />
        <div className="page-shell relative grid items-center gap-10 py-16 lg:grid-cols-[1fr_auto] sm:py-20">
          <div className="max-w-3xl">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-500">VP Refer & Earn</p>
            <h2 className="font-display mt-4 text-balance text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">Share a smarter profile check</h2>
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
              description="No false approval claims and no fake urgency. Payment is not required to view the initial result."
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
                  Verify email, unlock the {USP_TOTAL_WITH_GST_LABEL} Credit Profile Booster, then complete your profile for matched official partner links.
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

function ProcessCard({ number, icon: Icon, title, description }: { number: string; icon: typeof UserRoundCheck; title: string; description: string }) {
  return (
    <article className="relative rounded-[1.75rem] border border-line bg-white p-7 shadow-card sm:p-8">
      <div className="flex items-center justify-between">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-100 text-brand-700">
          <Icon size={22} />
        </span>
        <span className="font-display text-sm font-black text-slate-300">{number}</span>
      </div>
      <h3 className="font-display mt-7 text-xl font-extrabold tracking-[-0.02em] text-navy-950">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
    </article>
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
