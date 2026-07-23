import type { Metadata } from "next";
import { ArrowRight, BadgeCheck, Banknote, BriefcaseBusiness, Calculator, Check, CircleAlert, Gem, HeartHandshake, Home, Landmark, LockKeyhole, MessageCircle, ShieldCheck, Sparkles, Store, TrendingUp, UserRoundCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { EmiCalculator } from "@/components/emi-calculator";
import { PLATFORM_DISCLAIMER, RESULT_DISCLAIMER } from "@/lib/constants";

export const metadata: Metadata = { title: "Free Loan Options & Credit Health Check" };

const trustPoints = ["2-minute profile check", "शुरुआत में documents की जरूरत नहीं", "Personal और Business Loan categories", "Secure data handling", "No OTP, UPI PIN or bank password required", "Final approval lender verification पर निर्भर"];
const categories = [
  ["Personal Loan", "Income और current EMI के आधार पर unsecured option readiness.", Banknote],
  ["Business Loan", "Business vintage, bank statement और registration readiness.", BriefcaseBusiness],
  ["MSME Loan", "Small-business profile और documentary preparedness.", Store],
  ["Mudra Loan Guidance", "Scheme awareness और application document guidance.", Landmark],
  ["Gold Loan", "Gold-backed category की general readiness.", Gem],
  ["Loan Against Property", "Property-backed category और document checklist.", Home],
  ["Credit Health Support", "Repayment, utilization और dispute-process education.", TrendingUp],
] as const;
const rejectionReasons = ["Income के मुकाबले high EMI burden", "Recent overdue या irregular repayment", "Multiple recent enquiries/applications", "Incomplete या inconsistent documents", "Short employment/business vintage", "Requested amount profile से बहुत अधिक होना"];
const faqs = [
  ["क्या VP Loan Connect loan देता है?", "नहीं। हम bank, NBFC या lender नहीं हैं। हम preliminary profile assessment, educational guidance और optional verified lender-referral request प्रदान करते हैं."],
  ["क्या free result loan approval है?", "नहीं। Free result केवल internal educational assessment है। Final eligibility और sanction lender verification पर निर्भर है."],
  ["क्या शुरुआत में documents upload करने होंगे?", "नहीं। First assessment में हम केवल document availability पूछते हैं—sensitive documents upload नहीं करवाते."],
  ["क्या credit score guaranteed improve होगा?", "नहीं। हम official correction/dispute process और responsible credit habits समझाते हैं; कोई score increase guarantee नहीं करते."],
  ["मेरी जानकारी का उपयोग कैसे होगा?", "Requested assessment के लिए service consent आवश्यक है। Marketing consent अलग और optional है, और STOP भेजकर कभी भी वापस लिया जा सकता है."],
];

export default function HomePage() {
  const structuredData = { "@context": "https://schema.org", "@type": "FinancialService", name: "VP Loan Connect", url: "https://vploanconnect.in", description: PLATFORM_DISCLAIMER, areaServed: "IN", provider: { "@type": "Organization", name: "THE99CREW FACILITY MANAGEMENT" } };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <section className="hero-grid overflow-hidden bg-navy-950 text-white">
        <div className="page-shell grid min-h-[720px] items-center gap-12 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-2 text-xs font-bold text-brand-100"><Sparkles size={15} />Smart profile check • No approval claims</div>
            <h1 className="text-balance max-w-4xl text-4xl font-bold leading-[1.15] tracking-[-0.045em] sm:text-5xl lg:text-6xl">₹50,000 से ₹15 लाख तक के <span className="text-brand-500">Loan Options Check</span> करें</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">अपनी income, EMI, credit profile और documents के आधार पर suitable loan categories और comfortable EMI range जानें।</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row"><ButtonLink href="/assessment" size="lg">Free Loan Options Check करें <ArrowRight size={18} /></ButtonLink><ButtonLink href="/credit-health" variant="secondary" size="lg">Credit Health Check करें</ButtonLink></div>
            <div className="mt-9 grid gap-3 sm:grid-cols-2">{trustPoints.map((point) => <div key={point} className="flex items-start gap-2.5 text-sm leading-6 text-slate-300"><Check className="mt-1 shrink-0 text-brand-500" size={16} />{point}</div>)}</div>
          </div>
          <div className="relative">
            <div className="absolute -inset-10 rounded-full bg-brand-500/15 blur-3xl" />
            <div className="relative rounded-3xl border border-white/10 bg-white/7 p-4 shadow-2xl backdrop-blur sm:p-6">
              <div className="rounded-2xl bg-white p-6 text-navy-950 sm:p-8">
                <div className="flex items-center justify-between"><span className="rounded-full bg-brand-100 px-3 py-1.5 text-xs font-bold text-brand-700">Educational preview</span><ShieldCheck className="text-brand-600" /></div>
                <p className="mt-7 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Your profile snapshot</p>
                <div className="mt-5 grid grid-cols-2 gap-3"><PreviewStat label="Profile completion" value="92%" /><PreviewStat label="EMI burden" value="Moderate" /><PreviewStat label="Documents" value="Partial" /><PreviewStat label="Credit health" value="Review" /></div>
                <div className="mt-6 rounded-2xl bg-surface p-5"><p className="text-xs font-bold text-slate-500">Indicative comfortable EMI</p><p className="mt-1 text-2xl font-extrabold tracking-[-0.03em] text-navy-950">Calculated from your profile</p><p className="mt-2 text-xs leading-5 text-slate-500">No lender-approved amount is shown. Estimate only.</p></div>
                <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950"><CircleAlert className="mt-0.5 shrink-0" size={16} />Final decision is made solely by the lender after verification.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="section-space bg-white"><div className="page-shell"><SectionHeading eyebrow="Simple and transparent" title="पहले profile समझें, फिर application तैयार करें" description="Assessment किसी lender decision की नकल नहीं करता। यह आपके inputs को readiness factors में बदलकर practical next steps दिखाता है." align="center" /><div className="mt-12 grid gap-5 md:grid-cols-3">{[["01", "Profile details भरें", "Income, obligations, approximate credit range और document availability बताएं."], ["02", "Free preview देखें", "EMI burden, document status, internal readiness और suitable general categories समझें."], ["03", "अगला कदम चुनें", "Free guidance follow करें या optional personalized paid report खरीदें."]].map(([n,t,d]) => <div key={n} className="rounded-3xl border border-line bg-white p-7 shadow-card"><span className="text-sm font-black text-brand-600">{n}</span><h3 className="mt-5 text-xl font-bold text-navy-950">{t}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{d}</p></div>)}</div></div></section>

      <section id="loan-options" className="section-space bg-surface"><div className="page-shell"><SectionHeading eyebrow="General categories" title="एक profile, कई possible loan categories" description="हम verified profile inputs के आधार पर general categories बताते हैं—किसी specific lender का offer या approval नहीं." /><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{categories.map(([title, description, Icon]) => <article key={title} className="group rounded-2xl border border-line bg-white p-6 transition hover:-translate-y-1 hover:shadow-card"><span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-100 text-brand-700"><Icon size={21} /></span><h3 className="mt-5 font-bold text-navy-950">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></article>)}</div></div></section>

      <section className="section-space bg-white"><div className="page-shell grid items-center gap-12 lg:grid-cols-2"><div><SectionHeading eyebrow="Avoid preventable rejection" title="Loan applications अक्सर क्यों reject होती हैं?" description="हर lender की policy अलग होती है, लेकिन profile और paperwork में ये common gaps application को कमजोर कर सकते हैं." /><div className="mt-8 grid gap-3">{rejectionReasons.map((reason) => <div key={reason} className="flex items-start gap-3 rounded-xl bg-surface p-4 text-sm font-semibold text-navy-900"><CircleAlert className="mt-0.5 shrink-0 text-amber-600" size={18} />{reason}</div>)}</div></div><div className="rounded-3xl bg-navy-950 p-7 text-white sm:p-10"><UserRoundCheck className="text-brand-500" size={34} /><h3 className="mt-6 text-3xl font-bold tracking-[-0.035em]">Profile first क्यों?</h3><div className="mt-7 grid gap-5">{[["Clearer borrowing capacity", "Income के against indicative EMI comfort समझें."], ["Better document preparation", "Application से पहले missing documents पहचानें."], ["Fewer avoidable enquiries", "Random simultaneous applications से बचने की awareness."], ["Realistic category selection", "Unsecured और secured category readiness compare करें."]].map(([t,d]) => <div key={t} className="flex gap-4"><BadgeCheck className="mt-0.5 shrink-0 text-brand-500" size={20} /><div><p className="font-bold">{t}</p><p className="mt-1 text-sm leading-6 text-slate-300">{d}</p></div></div>)}</div></div></div></section>

      <section className="section-space bg-surface"><div className="page-shell grid gap-10 lg:grid-cols-[0.85fr_1.15fr]"><div><SectionHeading eyebrow="Estimate responsibly" title="Reducing-balance EMI calculator" description="Rate और tenure स्वयं adjust करें। Default rate केवल a realistic illustrative starting point है, offer नहीं." /><div className="mt-7 flex items-start gap-3 rounded-2xl border border-line bg-white p-5 text-sm leading-6 text-slate-600"><Calculator className="mt-0.5 shrink-0 text-brand-700" size={20} />Actual lender rate, fees, taxes, insurance and eligibility may differ.</div></div><EmiCalculator /></div></section>

      <section className="section-space bg-white"><div className="page-shell grid items-center gap-10 lg:grid-cols-2"><div className="rounded-3xl border border-line bg-surface p-7 sm:p-10"><TrendingUp className="text-brand-700" size={34} /><h3 className="mt-6 text-3xl font-bold tracking-[-0.035em] text-navy-950">Credit health awareness</h3><p className="mt-4 leading-8 text-slate-600">Credit report में overdue, DPD, utilization, settled status और enquiries को समझना responsible borrowing का हिस्सा है। Genuine error होने पर official dispute process follow करें.</p><ButtonLink href="/credit-health" variant="dark" className="mt-7">Explore Credit Health Check</ButtonLink></div><div><SectionHeading eyebrow="Know the boundaries" title="हम क्या कर सकते हैं—और क्या नहीं" /><div className="mt-7 grid gap-3">{["Credit-risk factors explain करना", "Responsible utilization guidance देना", "Official dispute checklist share करना", "30-day और 90-day action plan बनाना"].map((x) => <p key={x} className="flex gap-3 text-sm font-semibold text-navy-900"><Check className="shrink-0 text-brand-600" size={18} />{x}</p>)}</div><div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm leading-7 text-red-950">हम genuine defaults delete नहीं कर सकते, bureau records सीधे बदल नहीं सकते, और score improvement guarantee नहीं करते.</div></div></div></section>

      <section className="section-space bg-navy-950 text-white"><div className="page-shell grid items-center gap-10 lg:grid-cols-[1fr_auto]"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-500">VP Refer & Earn</p><h2 className="mt-4 text-balance text-3xl font-bold tracking-[-0.035em] sm:text-4xl">Responsible profile checks share करें</h2><p className="mt-5 max-w-2xl leading-8 text-slate-300">Validated, non-refunded paid orders पर rewards—click या registration पर नहीं। Self-referral और duplicate abuse blocked हैं.</p></div><ButtonLink href="/refer" variant="secondary" size="lg"><HeartHandshake size={19} />Referral program देखें</ButtonLink></div></section>

      <section className="section-space bg-white"><div className="page-shell"><SectionHeading eyebrow="Frequently asked" title="Common questions, clear answers" align="center" /><div className="mx-auto mt-10 max-w-3xl divide-y divide-line rounded-3xl border border-line bg-white px-6 shadow-card">{faqs.map(([q,a]) => <details key={q} className="group py-5"><summary className="cursor-pointer list-none pr-8 font-bold text-navy-950 marker:hidden">{q}</summary><p className="mt-3 text-sm leading-7 text-slate-600">{a}</p></details>)}</div></div></section>

      <section className="bg-surface py-12"><div className="page-shell"><div className="flex items-start gap-4 rounded-3xl border border-line bg-white p-6 sm:p-8"><LockKeyhole className="mt-1 shrink-0 text-brand-700" size={24} /><div><h2 className="font-bold text-navy-950">Important disclaimer</h2><p className="mt-2 text-sm leading-7 text-slate-600">{RESULT_DISCLAIMER} {PLATFORM_DISCLAIMER}</p></div></div></div></section>

      <section className="section-space bg-white"><div className="page-shell grid items-center gap-8 rounded-3xl bg-brand-100 p-7 sm:p-10 lg:grid-cols-[1fr_auto]"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Need help?</p><h2 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-navy-950">Free profile check से शुरू करें</h2><p className="mt-3 max-w-2xl leading-7 text-slate-600">हम OTP, UPI PIN, CVV, banking password या Aadhaar OTP कभी नहीं मांगते.</p></div><div className="flex flex-col gap-3 sm:flex-row"><ButtonLink href="/assessment" size="lg">Start free check <ArrowRight size={18} /></ButtonLink><ButtonLink href="/contact" variant="secondary" size="lg"><MessageCircle size={18} />Contact support</ButtonLink></div></div></section>
    </>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-line p-4"><p className="text-[11px] font-semibold text-slate-500">{label}</p><p className="mt-1 text-sm font-extrabold text-navy-950">{value}</p></div>; }
