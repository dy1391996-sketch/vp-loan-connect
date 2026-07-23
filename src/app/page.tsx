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
import { ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { PLATFORM_DISCLAIMER, RESULT_DISCLAIMER } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Free Loan Readiness Check & EMI Calculator",
  description: "Check your loan readiness in two minutes with a free preliminary analysis based on income, EMI, documents and credit profile.",
};

const trustItems = [
  ["Secure Assessment", ShieldCheck],
  ["No Documents Required Initially", FileCheck2],
  ["Personal & Business Loan Categories", BriefcaseBusiness],
  ["Data Privacy Protected", LockKeyhole],
  ["Transparent Assessment", SearchCheck],
  ["Educational Guidance", GraduationCap],
] as const;

const categories = [
  ["Personal Loan", "Review unsecured borrowing readiness against income and existing obligations.", Banknote],
  ["Business Loan", "Understand business vintage, cash-flow and document preparedness.", BriefcaseBusiness],
  ["MSME Loan", "Check readiness factors relevant to small and growing businesses.", Building2],
  ["Gold Loan", "Explore a secured category when eligible gold assets are available.", Gem],
  ["Loan Against Property", "Understand the profile and document path for property-backed options.", Home],
  ["Education Loan", "Prepare income, co-applicant and education-document information.", GraduationCap],
  ["Working Capital", "Review operational funding readiness for eligible businesses.", WalletCards],
] as const;

const rejectionReasons = [
  ["High EMI burden", "Existing monthly obligations leave limited repayment capacity."],
  ["Repayment concerns", "Current overdue or past settled accounts may need review."],
  ["Incomplete documents", "Missing income, banking or business proof can slow verification."],
  ["Unrealistic amount", "The requested amount may not align with reported income."],
  ["Short profile history", "Limited employment or business vintage can reduce readiness."],
  ["Too many applications", "Multiple recent enquiries may signal credit-seeking behaviour."],
] as const;

const faqs = [
  ["Does VP Loan Connect provide loans?", "No. VP Loan Connect is not a bank, NBFC, lender or credit bureau. We provide a preliminary educational assessment, report guidance and an optional future lender-referral request."],
  ["Is the free result a loan approval?", "No. It is an internal educational readiness view based on the details you provide. A regulated lender alone decides eligibility, rate, amount and approval after verification."],
  ["Do I need to upload documents?", "Not for the initial assessment. We only ask whether common documents are available. Never share a UPI PIN, CVV, bank password or Aadhaar OTP."],
  ["Will checking my profile affect my credit score?", "The free assessment uses your self-reported credit-score range and does not fetch a bureau report or perform a lender enquiry."],
  ["Is the paid report mandatory?", "No. The free preview is useful on its own. A personalized report is optional and appears only after your result."],
  ["How is my information used?", "Service consent is required only for your requested assessment. Marketing consent is separate, optional and can be withdrawn by sending STOP."],
] as const;

const journey = [
  ["01", "Landing Page", "Understand the service and its boundaries."],
  ["02", "Free Assessment", "Share only the profile details needed for analysis."],
  ["03", "Useful Preview", "See readiness, EMI comfort and document status."],
  ["04", "Detailed Report", "Choose an optional personalized action plan."],
  ["05", "Referral", "Share responsibly after receiving your referral link."],
  ["06", "Future Connection", "Request a verified lender referral only when available."],
] as const;

export default function HomePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "VP Loan Connect",
    url: "https://vploanconnect.in",
    description: "Preliminary educational loan-readiness assessment based on self-reported profile information.",
    areaServed: "IN",
    provider: { "@type": "Organization", name: "VP Loan Connect" },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <section className="hero-premium relative overflow-hidden bg-navy-950 text-white">
        <div className="page-shell grid min-h-[760px] items-center gap-14 py-16 lg:grid-cols-[1.06fr_0.94fr] lg:py-24">
          <div className="animate-rise relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/25 bg-brand-500/10 px-4 py-2 text-xs font-bold text-brand-100 backdrop-blur">
              <Sparkles size={15} aria-hidden="true" />
              Free preliminary profile assessment
            </div>
            <h1 className="mt-7 max-w-3xl text-balance text-4xl font-extrabold leading-[1.08] tracking-[-0.055em] sm:text-5xl lg:text-[4rem]">
              Check Your Loan Readiness in <span className="text-brand-500">Just 2 Minutes</span>
            </h1>
            <p className="mt-5 max-w-2xl text-balance text-xl font-semibold leading-8 text-white sm:text-2xl">
              सिर्फ 2 मिनट में जानिए आपकी Loan Profile कितनी Strong है
            </p>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              Get a free preliminary loan profile analysis based on your income, EMI, documents and credit profile.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/assessment" size="lg">
                Check My Eligibility <ArrowRight size={18} aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href="/#emi-calculator" variant="secondary" size="lg">
                <Calculator size={18} aria-hidden="true" /> Calculate My EMI
              </ButtonLink>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-300">
              <span className="flex items-center gap-2"><Clock3 className="text-brand-500" size={17} />About 2 minutes</span>
              <span className="flex items-center gap-2"><FileCheck2 className="text-brand-500" size={17} />No document upload</span>
              <span className="flex items-center gap-2"><LockKeyhole className="text-brand-500" size={17} />No PIN or bank password</span>
            </div>
          </div>

          <div className="animate-rise-delay relative mx-auto w-full max-w-xl lg:mx-0">
            <div className="absolute -inset-12 rounded-full bg-brand-500/15 blur-3xl" />
            <div className="animate-float relative rounded-[2rem] border border-white/12 bg-white/8 p-3 shadow-2xl backdrop-blur-xl sm:p-4">
              <div className="rounded-[1.5rem] bg-white p-5 text-navy-950 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-full bg-brand-100 px-3.5 py-2 text-xs font-extrabold text-brand-700">Sample Preview</span>
                  <span className="text-xs font-bold text-slate-500">Example only</span>
                </div>
                <div className="mt-6 flex items-end justify-between gap-5 rounded-2xl bg-navy-950 p-5 text-white">
                  <div>
                    <p className="text-xs font-semibold text-slate-300">Loan Readiness Score</p>
                    <p className="mt-2 text-sm font-bold text-brand-500">Profile Strength</p>
                    <p className="mt-1 text-xl font-extrabold">Moderate readiness</p>
                  </div>
                  <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full border-[7px] border-brand-500 bg-white/5">
                    <span className="text-2xl font-black">74<span className="text-xs text-slate-300">/100</span></span>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <SampleStat label="Estimated EMI Range" value="₹12k – ₹18k/month" />
                  <SampleStat label="Documentation Status" value="Partial" />
                  <SampleStat label="Credit Health Status" value="Review suggested" />
                  <SampleStat label="Suggested Loan Categories" value="Personal · Gold" />
                </div>
                <div className="mt-4 flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-950">
                  <CircleAlert className="mt-0.5 shrink-0" size={16} />
                  <span><strong>Sample Preview — Example only.</strong> Your result is calculated from your own answers and is not a loan approval.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Trust and service principles" className="relative z-10 -mt-7 pb-5">
        <div className="page-shell">
          <div className="grid gap-px overflow-hidden rounded-3xl border border-line bg-line shadow-soft sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {trustItems.map(([label, Icon]) => (
              <div key={label} className="flex min-h-32 flex-col justify-center gap-4 bg-white p-5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-100 text-brand-700"><Icon size={19} /></span>
                <p className="text-sm font-bold leading-5 text-navy-950">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="section-space bg-white">
        <div className="page-shell">
          <SectionHeading eyebrow="Simple by design" title="A clear first step before you apply" description="Understand your profile without a hard sell. The free assessment gives you practical context, and every next step remains your choice." align="center" />
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            <ProcessCard number="01" icon={UserRoundCheck} title="Tell us about your profile" description="Answer simple questions about income, existing EMI, approximate credit range and document availability." />
            <ProcessCard number="02" icon={ChartNoAxesCombined} title="See your free preview" description="Review your internal readiness, EMI comfort, document status, strengths and improvement areas." />
            <ProcessCard number="03" icon={HandCoins} title="Choose your next step" description="Use the free guidance, calculate EMI, or select an optional detailed report only if it helps you." />
          </div>
        </div>
      </section>

      <section id="loan-options" className="section-space surface-grid bg-surface">
        <div className="page-shell">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <SectionHeading eyebrow="Possible categories" title="Explore loan categories with better context" description="Categories are educational suggestions based on profile characteristics—not lender offers, approvals or guaranteed eligibility." />
            <ButtonLink href="/assessment" variant="secondary">See Your Loan Readiness <ArrowRight size={17} /></ButtonLink>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map(([title, description, Icon]) => (
              <article key={title} className="group rounded-3xl border border-line/80 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-brand-500/40 hover:shadow-card">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-100 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white"><Icon size={22} /></span>
                <h3 className="mt-6 text-lg font-extrabold text-navy-950">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
              </article>
            ))}
            <article className="flex min-h-64 flex-col justify-between rounded-3xl bg-navy-950 p-7 text-white shadow-card sm:col-span-2 lg:col-span-1">
              <div><Landmark className="text-brand-500" size={28} /><h3 className="mt-6 text-xl font-extrabold">Not sure where to start?</h3><p className="mt-3 text-sm leading-7 text-slate-300">Let the assessment compare your profile with general category factors.</p></div>
              <ButtonLink href="/assessment" className="mt-6 w-full">Check Possible Options</ButtonLink>
            </article>
          </div>
        </div>
      </section>

      <section id="benefits" className="section-space bg-white">
        <div className="page-shell grid items-start gap-14 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Common application gaps" title="Why applications may get rejected" description="Every lender follows its own policy. These common profile gaps can still make an application harder to assess." />
            <div className="mt-9 grid gap-3 sm:grid-cols-2">
              {rejectionReasons.map(([title, description]) => (
                <div key={title} className="rounded-2xl bg-surface p-5">
                  <div className="flex items-center gap-3"><CircleAlert className="shrink-0 text-amber-600" size={18} /><h3 className="font-extrabold text-navy-950">{title}</h3></div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[2rem] bg-navy-950 p-7 text-white shadow-soft sm:p-10">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-500/12 px-4 py-2 text-xs font-bold text-brand-100"><BadgeCheck size={16} />Profile-first benefits</span>
            <h2 className="mt-7 text-balance text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">Apply with clarity, not guesswork</h2>
            <div className="mt-8 grid gap-6">
              <Benefit title="A more realistic EMI view" description="Estimate a comfortable range before committing to a tenure." />
              <Benefit title="Better document preparation" description="Spot missing proofs early, without uploading them during the free check." />
              <Benefit title="Smarter category selection" description="Understand when unsecured or secured options may deserve a closer look." />
              <Benefit title="Fewer avoidable applications" description="Pause and improve gaps instead of applying everywhere at once." />
            </div>
          </div>
        </div>
      </section>

      <section id="emi-calculator" className="section-space surface-grid bg-surface">
        <div className="page-shell grid items-start gap-12 lg:grid-cols-[0.72fr_1.28fr]">
          <div className="lg:sticky lg:top-28">
            <SectionHeading eyebrow="Plan the repayment" title="Estimate Your EMI" description="Adjust the amount, annual rate and tenure. The reducing-balance calculation gives an indicative monthly repayment—not a lender quote." />
            <div className="mt-7 flex items-start gap-3 rounded-2xl border border-line bg-white p-5 text-sm leading-7 text-slate-600">
              <Calculator className="mt-1 shrink-0 text-brand-700" size={20} />
              Actual rate, fees, insurance, taxes and eligibility vary by lender.
            </div>
          </div>
          <EmiCalculator />
        </div>
      </section>

      <section className="section-space bg-white">
        <div className="page-shell">
          <SectionHeading eyebrow="Customer journey" title="A natural path, with no forced step" description="Start free, use what is useful, and move forward only when you are comfortable." align="center" />
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {journey.map(([number, title, description]) => (
              <div key={number} className="relative rounded-3xl border border-line bg-white p-6 shadow-sm">
                <span className="text-sm font-black text-brand-600">{number}</span>
                <h3 className="mt-4 text-lg font-extrabold text-navy-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden bg-navy-950 py-16 text-white sm:py-20">
        <div className="page-shell grid items-center gap-10 lg:grid-cols-[1fr_auto]">
          <div className="max-w-3xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-500">VP Refer & Earn</p>
            <h2 className="mt-4 text-balance text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">Share a responsible profile-first approach</h2>
            <p className="mt-5 max-w-2xl leading-8 text-slate-300">Rewards apply only to validated, non-refunded qualifying report purchases—never clicks, registrations or loan approvals.</p>
          </div>
          <ButtonLink href="/refer" variant="secondary" size="lg"><HeartHandshake size={19} />Explore Referral Program</ButtonLink>
        </div>
      </section>

      <section id="faq" className="section-space bg-white">
        <div className="page-shell grid gap-12 lg:grid-cols-[0.68fr_1.32fr]">
          <div>
            <SectionHeading eyebrow="Frequently asked questions" title="Clear answers build better decisions" description="No hidden approval claims, no fake urgency, and no need to buy anything to see your free preview." />
            <ButtonLink href="/contact" variant="secondary" className="mt-7"><MessageCircle size={18} />Contact Support Team</ButtonLink>
          </div>
          <div className="grid gap-3">
            {faqs.map(([question, answer]) => (
              <details key={question} className="group rounded-2xl border border-line bg-white p-5 transition open:border-brand-500/40 open:shadow-card sm:p-6">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-5 font-extrabold text-navy-950 marker:hidden">
                  {question}
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface text-brand-700 transition group-open:rotate-90"><ChevronRight size={17} /></span>
                </summary>
                <p className="mt-4 max-w-3xl pr-8 text-sm leading-7 text-slate-600">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-surface py-10">
        <div className="page-shell">
          <div className="flex items-start gap-4 rounded-3xl border border-line bg-white p-6 sm:p-8">
            <LockKeyhole className="mt-1 shrink-0 text-brand-700" size={23} />
            <div>
              <h2 className="font-extrabold text-navy-950">Important assessment boundary</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">{RESULT_DISCLAIMER} {PLATFORM_DISCLAIMER}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-space bg-white">
        <div className="page-shell">
          <div className="relative overflow-hidden rounded-[2rem] bg-brand-100 p-7 sm:p-10 lg:p-14">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-500/15 blur-3xl" />
            <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_auto]">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-700">Start with clarity</p>
                <h2 className="mt-4 text-balance text-3xl font-extrabold tracking-[-0.045em] text-navy-950 sm:text-4xl">Ready to understand your loan profile?</h2>
                <p className="mt-4 max-w-2xl leading-8 text-slate-600">Complete the free check first. No sensitive document upload and no promise of approval.</p>
              </div>
              <ButtonLink href="/assessment" size="lg">Check My Eligibility <ArrowRight size={18} /></ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function SampleStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-[11px] font-bold text-slate-500">{label}</p>
      <p className="mt-1.5 text-sm font-extrabold text-navy-950">{value}</p>
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-brand-700">Sample Preview</p>
    </div>
  );
}

function ProcessCard({ number, icon: Icon, title, description }: { number: string; icon: typeof UserRoundCheck; title: string; description: string }) {
  return (
    <article className="relative rounded-3xl border border-line bg-white p-7 shadow-card sm:p-8">
      <div className="flex items-center justify-between">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-100 text-brand-700"><Icon size={22} /></span>
        <span className="text-sm font-black text-slate-300">{number}</span>
      </div>
      <h3 className="mt-7 text-xl font-extrabold text-navy-950">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
    </article>
  );
}

function Benefit({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex gap-4">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-500 text-navy-950"><Check size={15} strokeWidth={3} /></span>
      <div><h3 className="font-extrabold">{title}</h3><p className="mt-1.5 text-sm leading-6 text-slate-300">{description}</p></div>
    </div>
  );
}
