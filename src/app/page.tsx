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
  title: "मुफ़्त Loan Profile Check और EMI Calculator",
  description: "सिर्फ दो मिनट में आय, EMI, documents और credit profile के आधार पर अपनी शुरुआती loan readiness जाँचें।",
};

const trustItems = [
  ["सुरक्षित Assessment", ShieldCheck],
  ["शुरुआत में Documents नहीं", FileCheck2],
  ["Personal और Business Loan", BriefcaseBusiness],
  ["आपकी जानकारी सुरक्षित", LockKeyhole],
  ["साफ़ और पारदर्शी Result", SearchCheck],
  ["सही जानकारी और मार्गदर्शन", GraduationCap],
] as const;

const categories = [
  ["Personal Loan", "आय और मौजूदा EMI के अनुसार personal loan की तैयारी समझें।", Banknote],
  ["Business Loan", "Business की अवधि, cash-flow और documents की तैयारी समझें।", BriefcaseBusiness],
  ["MSME Loan", "छोटे और बढ़ते business के लिए जरूरी profile factors देखें।", Building2],
  ["Gold Loan", "Gold उपलब्ध होने पर secured loan category समझें।", Gem],
  ["Loan Against Property", "Property के आधार पर loan के लिए profile और documents समझें।", Home],
  ["Education Loan", "Income, co-applicant और education documents तैयार करें।", GraduationCap],
  ["Working Capital", "Business working capital के लिए profile readiness देखें।", WalletCards],
] as const;

const rejectionReasons = [
  ["अधिक EMI का दबाव", "मौजूदा EMI के कारण नई repayment की क्षमता कम हो सकती है।"],
  ["Repayment की समस्या", "Current overdue या पुराने settled account की जाँच जरूरी हो सकती है।"],
  ["अधूरे Documents", "Income, banking या business proof की कमी verification रोक सकती है।"],
  ["आय से अधिक Loan Amount", "माँगी गई राशि आपकी बताई आय के अनुसार अधिक हो सकती है।"],
  ["कम नौकरी या Business अवधि", "कम employment या business history profile कमजोर कर सकती है।"],
  ["बहुत अधिक Applications", "कम समय में कई enquiries CIBIL profile पर असर डाल सकती हैं।"],
] as const;

const faqs = [
  ["क्या VP Loan Connect खुद loan देता है?", "नहीं। VP Loan Connect bank, NBFC, lender या credit bureau नहीं है। हम profile assessment, report guidance और आपकी इच्छा पर official lender options देते हैं।"],
  ["क्या free result loan approval है?", "नहीं। यह आपके दिए जवाबों पर आधारित शुरुआती profile view है। Eligibility, rate, amount और approval केवल संबंधित lender तय करता है।"],
  ["क्या documents upload करने होंगे?", "शुरुआती assessment में नहीं। हम केवल documents की उपलब्धता पूछते हैं। UPI PIN, CVV, bank password या Aadhaar OTP कभी साझा न करें।"],
  ["क्या profile check करने से CIBIL score प्रभावित होगा?", "यह assessment आपके बताए CIBIL range का उपयोग करता है। यह bureau report नहीं निकालता और कोई lender enquiry नहीं करता।"],
  ["क्या ₹99 report जरूरी है?", "नहीं। शुरुआती result free है। ₹99 plan optional है और personalized analysis व official application options खोलता है।"],
  ["मेरी जानकारी का उपयोग कैसे होगा?", "Service consent केवल assessment के लिए है। Marketing consent अलग और optional है; STOP भेजकर इसे बंद किया जा सकता है।"],
] as const;

const journey = [
  ["01", "जानकारी देखें", "Service और उसकी सीमाएँ समझें।"],
  ["02", "मुफ़्त Assessment", "Analysis के लिए जरूरी profile details दें।"],
  ["03", "शुरुआती Result", "Readiness, EMI क्षमता और documents की स्थिति देखें।"],
  ["04", "₹99 Profile Plan", "चाहें तो personalized analysis खोलें।"],
  ["05", "Official Loan Options", "Payment के बाद profile के अनुसार official links देखें।"],
  ["06", "अपनी इच्छा से Apply करें", "बिना automatic data sharing के official lender site पर जाएँ।"],
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
              मुफ़्त शुरुआती profile assessment
            </div>
            <h1 className="mt-7 max-w-3xl text-balance text-4xl font-extrabold leading-[1.08] tracking-[-0.055em] sm:text-5xl lg:text-[4rem]">
              अपनी Loan Readiness जानें <span className="text-brand-500">सिर्फ 2 मिनट में</span>
            </h1>
            <p className="mt-5 max-w-2xl text-balance text-xl font-semibold leading-8 text-white sm:text-2xl">
              Income, EMI, CIBIL range और documents के आधार पर अपनी profile समझें
            </p>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              पहले free result देखें। फिर जरूरत हो तो ₹99 में personalized analysis और official lender options खोलें।
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/assessment" size="lg">
                मेरी Profile जाँचें <ArrowRight size={18} aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href="/#emi-calculator" variant="secondary" size="lg">
                <Calculator size={18} aria-hidden="true" /> मेरी EMI निकालें
              </ButtonLink>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-300">
              <span className="flex items-center gap-2"><Clock3 className="text-brand-500" size={17} />लगभग 2 मिनट</span>
              <span className="flex items-center gap-2"><FileCheck2 className="text-brand-500" size={17} />Document upload नहीं</span>
              <span className="flex items-center gap-2"><LockKeyhole className="text-brand-500" size={17} />PIN या bank password नहीं</span>
            </div>
          </div>

          <div className="animate-rise-delay relative mx-auto w-full max-w-xl lg:mx-0">
            <div className="absolute -inset-12 rounded-full bg-brand-500/15 blur-3xl" />
            <div className="animate-float relative rounded-[2rem] border border-white/12 bg-white/8 p-3 shadow-2xl backdrop-blur-xl sm:p-4">
              <div className="rounded-[1.5rem] bg-white p-5 text-navy-950 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-full bg-brand-100 px-3.5 py-2 text-xs font-extrabold text-brand-700">नमूना Result</span>
                  <span className="text-xs font-bold text-slate-500">केवल उदाहरण</span>
                </div>
                <div className="mt-6 flex items-end justify-between gap-5 rounded-2xl bg-navy-950 p-5 text-white">
                  <div>
                    <p className="text-xs font-semibold text-slate-300">Loan Readiness Score</p>
                    <p className="mt-2 text-sm font-bold text-brand-500">Profile की स्थिति</p>
                    <p className="mt-1 text-xl font-extrabold">मध्यम readiness</p>
                  </div>
                  <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full border-[7px] border-brand-500 bg-white/5">
                    <span className="text-2xl font-black">74<span className="text-xs text-slate-300">/100</span></span>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <SampleStat label="अनुमानित EMI Range" value="₹12k – ₹18k/month" />
                  <SampleStat label="Documents की स्थिति" value="कुछ बाकी" />
                  <SampleStat label="Credit Profile" value="Review जरूरी" />
                  <SampleStat label="संभावित Loan Categories" value="Personal · Gold" />
                </div>
                <div className="mt-4 flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-950">
                  <CircleAlert className="mt-0.5 shrink-0" size={16} />
                  <span><strong>नमूना Result — केवल उदाहरण.</strong> आपका result आपके जवाबों से बनेगा; यह loan approval नहीं है।</span>
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
          <SectionHeading eyebrow="आसान प्रक्रिया" title="Apply करने से पहले सही profile check" description="पहले अपनी profile समझें। शुरुआती result free है और आगे बढ़ना पूरी तरह आपकी इच्छा है।" align="center" />
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            <ProcessCard number="01" icon={UserRoundCheck} title="अपनी profile की जानकारी दें" description="Income, मौजूदा EMI, अनुमानित CIBIL range और documents के आसान सवालों के जवाब दें।" />
            <ProcessCard number="02" icon={ChartNoAxesCombined} title="Free शुरुआती result देखें" description="Readiness, EMI क्षमता, documents, मजबूत बातें और सुधार की जरूरत देखें।" />
            <ProcessCard number="03" icon={HandCoins} title="अपना अगला कदम चुनें" description="Free result के बाद चाहें तो ₹99 personalized plan और official loan options खोलें।" />
          </div>
        </div>
      </section>

      <section id="loan-options" className="section-space surface-grid bg-surface">
        <div className="page-shell">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <SectionHeading eyebrow="संभावित Categories" title="अपनी profile के अनुसार loan categories समझें" description="ये profile-आधारित सुझाव हैं; lender offer, approval या guaranteed eligibility नहीं।" />
            <ButtonLink href="/assessment" variant="secondary">अपनी Profile देखें <ArrowRight size={17} /></ButtonLink>
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
              <div><Landmark className="text-brand-500" size={28} /><h3 className="mt-6 text-xl font-extrabold">समझ नहीं आ रहा कहाँ से शुरू करें?</h3><p className="mt-3 text-sm leading-7 text-slate-300">Assessment आपकी profile को सामान्य eligibility factors से compare करेगा।</p></div>
              <ButtonLink href="/assessment" className="mt-6 w-full">संभावित Options देखें</ButtonLink>
            </article>
          </div>
        </div>
      </section>

      <section id="benefits" className="section-space bg-white">
        <div className="page-shell grid items-start gap-14 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Application की सामान्य कमियाँ" title="Loan application reject क्यों हो सकती है" description="हर lender की policy अलग है। ये सामान्य कमियाँ application को कमजोर कर सकती हैं।" />
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
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-500/12 px-4 py-2 text-xs font-bold text-brand-100"><BadgeCheck size={16} />पहले Profile, फिर Application</span>
            <h2 className="mt-7 text-balance text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">बिना सोचे कई जगह apply न करें</h2>
            <div className="mt-8 grid gap-6">
              <Benefit title="सही EMI का अंदाजा" description="Tenure चुनने से पहले आरामदायक EMI range समझें।" />
              <Benefit title="Documents पहले तैयार करें" description="Free check में upload किए बिना missing proofs समझें।" />
              <Benefit title="सही loan category चुनें" description="समझें कि unsecured या secured option में क्या बेहतर हो सकता है।" />
              <Benefit title="अनावश्यक applications कम करें" description="हर जगह apply करने से पहले profile की कमियाँ सुधारें।" />
            </div>
          </div>
        </div>
      </section>

      <section id="emi-calculator" className="section-space surface-grid bg-surface">
        <div className="page-shell grid items-start gap-12 lg:grid-cols-[0.72fr_1.28fr]">
          <div className="lg:sticky lg:top-28">
            <SectionHeading eyebrow="Repayment की योजना" title="अपनी EMI का अनुमान लगाएँ" description="Amount, annual rate और tenure बदलकर अनुमानित monthly EMI देखें। यह lender quote नहीं है।" />
            <div className="mt-7 flex items-start gap-3 rounded-2xl border border-line bg-white p-5 text-sm leading-7 text-slate-600">
              <Calculator className="mt-1 shrink-0 text-brand-700" size={20} />
              Actual rate, fees, insurance, taxes और eligibility हर lender में अलग हो सकती है।
            </div>
          </div>
          <EmiCalculator />
        </div>
      </section>

      <section className="section-space bg-white">
        <div className="page-shell">
          <SectionHeading eyebrow="पूरी प्रक्रिया" title="कोई जबरदस्ती नहीं—हर कदम आपकी इच्छा से" description="Free assessment से शुरू करें और जरूरत होने पर ही आगे बढ़ें।" align="center" />
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
            <h2 className="mt-4 text-balance text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">सही profile check दूसरों के साथ साझा करें</h2>
            <p className="mt-5 max-w-2xl leading-8 text-slate-300">Reward केवल valid और non-refunded report purchase पर लागू होगा; clicks, registration या loan approval पर नहीं।</p>
          </div>
          <ButtonLink href="/refer" variant="secondary" size="lg"><HeartHandshake size={19} />Explore Official Loan Options Program</ButtonLink>
        </div>
      </section>

      <section id="faq" className="section-space bg-white">
        <div className="page-shell grid gap-12 lg:grid-cols-[0.68fr_1.32fr]">
          <div>
            <SectionHeading eyebrow="सामान्य सवाल" title="साफ़ जवाब, बेहतर फैसला" description="न approval का झूठा दावा, न fake urgency। शुरुआती result देखने के लिए payment जरूरी नहीं।" />
            <ButtonLink href="/contact" variant="secondary" className="mt-7"><MessageCircle size={18} />Support से संपर्क करें</ButtonLink>
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
              <h2 className="font-extrabold text-navy-950">जरूरी जानकारी</h2>
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
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-700">सही जानकारी से शुरू करें</p>
                <h2 className="mt-4 text-balance text-3xl font-extrabold tracking-[-0.045em] text-navy-950 sm:text-4xl">अपनी loan profile समझने के लिए तैयार हैं?</h2>
                <p className="mt-4 max-w-2xl leading-8 text-slate-600">पहले free check पूरा करें। कोई sensitive document upload नहीं और approval का कोई झूठा promise नहीं।</p>
              </div>
              <ButtonLink href="/assessment" size="lg">मेरी Profile जाँचें <ArrowRight size={18} /></ButtonLink>
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
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-brand-700">नमूना Result</p>
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
