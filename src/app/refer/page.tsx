import type { Metadata } from "next";
import { ArrowRight, Check, CircleAlert, IndianRupee, Share2, ShieldCheck, WalletCards } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";

export const metadata: Metadata = {
  title: "VP Refer & Earn",
  description: "Share responsible profile checks and earn only on validated, non-refunded qualifying orders.",
};

const steps = [
  [Share2, "Share your unique link", "Use the ready-to-share compliant message with no approval promise."],
  [ShieldCheck, "We validate the purchase", "Rewards remain pending during the configurable fraud and refund review period."],
  [WalletCards, "Receive approved rewards", "Only approved balances count towards the minimum payout threshold."],
] as const;

const rules = [
  "No self-referral",
  "No duplicate-mobile or repeated-payment abuse",
  "No reward for clicks or registrations alone",
  "Refunded or fraudulent orders are rejected or reversed",
  "Bonus milestones remain configurable and activate only after approval",
];

export default function ReferPage() {
  return (
    <>
      <section className="hero-premium bg-navy-950 py-16 text-white sm:py-24">
        <div className="page-shell grid items-center gap-12 lg:grid-cols-[1fr_0.72fr]">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-500">VP Refer & Earn</p>
            <h1 className="mt-5 text-balance text-4xl font-extrabold tracking-[-0.05em] sm:text-5xl">Share responsible loan-readiness checks</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">Earn only when a referred user completes a validated, non-refunded qualifying report purchase—not for clicks, registrations or loan approval.</p>
            <ButtonLink href="/assessment" size="lg" className="mt-9">Complete Your Free Check <ArrowRight size={18} /></ButtonLink>
          </div>
          <div className="rounded-[2rem] border border-white/10 bg-white/8 p-4 shadow-2xl backdrop-blur">
            <div className="rounded-3xl bg-white p-7 text-navy-950 sm:p-8">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-100 text-brand-700"><IndianRupee size={24} /></span>
              <p className="mt-6 text-sm font-semibold text-slate-500">Default qualifying reward</p>
              <p className="mt-1 text-5xl font-black tracking-[-0.06em]">₹20</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">Per validated ₹99 Credit Health Action Plan purchase. Reward values remain configurable.</p>
              <div className="mt-6 rounded-2xl bg-surface p-5 text-sm text-slate-600">Minimum payout threshold <strong className="mt-1 block text-lg text-navy-950">₹250</strong></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-space bg-white">
        <div className="page-shell">
          <SectionHeading eyebrow="Simple and accountable" title="How referral rewards work" description="Your unique referral access is created from a verified assessment profile." align="center" />
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {steps.map(([Icon, title, description], index) => (
              <article key={title} className="rounded-3xl border border-line bg-white p-7 shadow-card">
                <div className="flex items-center justify-between"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-100 text-brand-700"><Icon size={22} /></span><span className="text-sm font-black text-slate-300">0{index + 1}</span></div>
                <h2 className="mt-7 text-xl font-extrabold text-navy-950">{title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="surface-grid section-space bg-surface">
        <div className="page-shell grid gap-8 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-[2rem] bg-white p-7 shadow-card sm:p-9">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-700">Fair-use rules</p>
            <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.045em] text-navy-950">Designed for genuine referrals</h2>
            <div className="mt-7 grid gap-4">
              {rules.map((item) => <p key={item} className="flex gap-3 text-sm font-semibold leading-6 text-navy-900"><span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700"><Check size={14} /></span>{item}</p>)}
            </div>
          </div>
          <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-7 sm:p-9">
            <CircleAlert className="text-amber-700" size={26} />
            <h2 className="mt-6 text-2xl font-extrabold text-amber-950">Share responsibly</h2>
            <p className="mt-4 text-sm leading-7 text-amber-950">The referral message clearly states that VP Loan Connect provides a free profile preview and educational report. It never promises a loan, approval, rate or credit-score increase.</p>
          </div>
        </div>
      </section>
    </>
  );
}
