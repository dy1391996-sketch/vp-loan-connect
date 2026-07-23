import type { Metadata } from "next";
import { Check, ChevronRight, CircleAlert, FileCheck2, Gauge, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { PublicStatePanel } from "@/components/ui/public-state-panel";
import { RESULT_DISCLAIMER } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { trackServerEvent } from "@/lib/server-analytics";
import { verifyAccessToken } from "@/lib/security/tokens";
import { formatInr } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your Free Profile Result", robots: { index: false, follow: false } };

export default async function ResultPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) {
  const { id } = await params;
  const { token } = await searchParams;
  if (!token) return <AccessDenied />;
  try {
    const payload = await verifyAccessToken(token, "result_access");
    if (payload.sub !== id) return <AccessDenied />;
  } catch { return <AccessDenied />; }
  const assessment = await prisma.assessment.findUnique({ where: { id }, include: { lead: true, score: true } });
  if (!assessment?.score || assessment.lead.deletedAt) notFound();
  const score = assessment.score;
  const categories = asStringArray(score.suitableCategories);
  const strengths = asStringArray(score.strengths);
  const improvements = asStringArray(score.improvements);
  await Promise.all([
    prisma.lead.update({ where: { id: assessment.leadId }, data: { stage: "FREE_RESULT_VIEWED" } }),
    trackServerEvent("free_result_viewed", { leadId: assessment.leadId, page: `/result/${id}` }),
  ]).catch(() => undefined);

  return (
    <section className="surface-grid min-h-screen bg-surface py-10 sm:py-16">
      <div className="page-shell">
        <div className="mx-auto max-w-5xl">
          <div className="relative overflow-hidden rounded-[2rem] bg-navy-950 p-6 text-white shadow-soft sm:p-10">
            <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand-500/15 blur-3xl" />
            <div className="flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
              <div className="relative"><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-500">Your free profile result</p><h1 className="mt-4 text-balance text-3xl font-extrabold tracking-[-0.045em] sm:text-5xl">{assessment.lead.fullName}, आपकी profile snapshot तैयार है</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">A useful internal educational view—not a credit-bureau score or lender decision.</p></div>
              <div className="relative shrink-0 rounded-3xl border border-white/10 bg-white/8 p-6 backdrop-blur sm:text-right"><p className="text-xs font-semibold text-slate-300">Loan readiness score</p><p className="mt-1 text-5xl font-black tracking-[-0.06em] text-brand-500">{score.readinessScore}<span className="text-lg text-slate-400">/100</span></p><p className="mt-2 text-sm font-extrabold">{score.readinessLabel}</p></div>
            </div>
            <div className="relative mt-8 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-brand-500" style={{ width: `${score.readinessScore}%` }} /></div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatusCard icon={Gauge} label="Profile completion" value={`${assessment.completionPercent}%`} tone="green" />
            <StatusCard icon={TrendingUp} label="EMI burden" value={score.emiBurden} tone={score.emiBurden === "Low" ? "green" : score.emiBurden === "Moderate" ? "amber" : "red"} />
            <StatusCard icon={FileCheck2} label="Documentation" value={score.documentationStatus} tone={score.documentationStatus === "Strong" ? "green" : "amber"} />
            <StatusCard icon={ShieldCheck} label="Credit health" value={score.creditHealthStatus} tone={score.creditHealthStatus === "Healthy" ? "green" : score.creditHealthStatus === "Review suggested" ? "amber" : "red"} />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-700">Indicative EMI comfort</p><p className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-navy-950">{formatInr(Number(score.comfortableEmiMin))} – {formatInr(Number(score.comfortableEmiMax))}<span className="text-sm font-semibold text-slate-500"> /month</span></p><p className="mt-3 text-sm leading-6 text-slate-600">Income-range midpoint और existing EMI के आधार पर internal estimate. यह lender offer नहीं है.</p></div>
            <div className="rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-700">General categories to explore</p><div className="mt-4 flex flex-wrap gap-2">{categories.map((category) => <span key={category} className="rounded-full bg-brand-100 px-3 py-2 text-xs font-bold text-brand-700">{category}</span>)}</div></div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2"><ResultList title="Main profile strengths" icon={Check} items={strengths} positive /><ResultList title="Main improvement areas" icon={CircleAlert} items={improvements} /></div>

          <div className="mt-5 flex items-start gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-950"><CircleAlert className="mt-1 shrink-0" size={20} /><p>{RESULT_DISCLAIMER}</p></div>

          <div className="mt-14 text-center"><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-700">Optional personalized reports</p><h2 className="mt-3 text-balance text-3xl font-extrabold tracking-[-0.045em] text-navy-950">Choose your next practical step</h2><p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-600">Your free result above is complete and useful on its own. A paid report is optional and covers personalized analysis and educational guidance—not lender processing or approval.</p></div>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <ProductOffer title="VP Credit Health Action Plan" heading="जानिए आपकी Credit Profile में सबसे पहले क्या सुधार करना चाहिए" regular="₹199 + GST" price="₹99 + 18% GST" total="₹116.82 total" href={`/checkout?product=credit-health-action-plan&assessment=${id}&token=${encodeURIComponent(token)}`} features={["Personalized credit-risk summary", "30-day action plan", "90-day improvement roadmap", "Branded PDF report"]} />
            <ProductOffer featured title="Complete Loan Readiness Report" heading="Application से पहले complete readiness roadmap" regular="₹599 + GST" price="₹299 + 18% GST" total="₹352.82 total" href={`/checkout?product=complete-loan-readiness-report&assessment=${id}&token=${encodeURIComponent(token)}`} features={["Income and obligation analysis", "Document and rejection-risk checklist", "30-day preparation plan", "15-minute consultation request"]} />
          </div>
        </div>
      </div>
    </section>
  );
}

function asStringArray(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function StatusCard({ icon: Icon, label, value, tone }: { icon: typeof Gauge; label: string; value: string; tone: "green" | "amber" | "red" }) { const colors = { green: "bg-brand-100 text-brand-700", amber: "bg-amber-100 text-amber-800", red: "bg-red-100 text-red-800" }; return <div className="rounded-3xl border border-line bg-white p-5 shadow-sm"><span className={`grid h-11 w-11 place-items-center rounded-2xl ${colors[tone]}`}><Icon size={19} /></span><p className="mt-4 text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 font-extrabold text-navy-950">{value}</p></div>; }
function ResultList({ title, icon: Icon, items, positive }: { title: string; icon: typeof Check; items: string[]; positive?: boolean }) { return <div className="rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-8"><h2 className="text-xl font-extrabold text-navy-950">{title}</h2><div className="mt-5 grid gap-4">{items.map((item) => <div key={item} className="flex items-start gap-3 text-sm leading-7 text-slate-600"><span className={`mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full ${positive ? "bg-brand-100 text-brand-700" : "bg-amber-100 text-amber-800"}`}><Icon size={14} /></span>{item}</div>)}</div></div>; }
function ProductOffer({ title, heading, regular, price, total, features, href, featured }: { title: string; heading: string; regular: string; price: string; total: string; features: string[]; href: string; featured?: boolean }) { return <article className={`relative rounded-[2rem] border p-6 shadow-card sm:p-8 ${featured ? "border-brand-500 bg-navy-950 text-white" : "border-line bg-white text-navy-950"}`}>{featured ? <span className="absolute right-5 top-5 rounded-full bg-brand-500 px-3 py-1.5 text-[10px] font-black uppercase text-navy-950">50% off</span> : null}<Sparkles className="text-brand-500" /><p className={`mt-5 text-xs font-extrabold uppercase tracking-[0.15em] ${featured ? "text-brand-500" : "text-brand-700"}`}>{title}</p><h3 className="mt-3 pr-12 text-2xl font-extrabold tracking-[-0.035em]">{heading}</h3><div className="mt-5"><p className={`text-xs line-through ${featured ? "text-slate-400" : "text-slate-500"}`}>{regular}</p><p className="mt-1 text-2xl font-extrabold">{price}</p><p className={`text-xs ${featured ? "text-slate-300" : "text-slate-500"}`}>{total}</p></div><div className="mt-6 grid gap-3">{features.map((feature) => <p key={feature} className={`flex gap-2 text-sm ${featured ? "text-slate-300" : "text-slate-600"}`}><Check className="shrink-0 text-brand-500" size={17} />{feature}</p>)}</div><ButtonLink href={href} variant={featured ? "primary" : "dark"} className="mt-7 w-full">View Secure Checkout <ChevronRight size={17} /></ButtonLink></article>; }
function AccessDenied() { return <PublicStatePanel icon={ShieldCheck} title="Secure result link required" description="This result link is missing, invalid or expired. Complete the assessment again or open the secure link sent after submission." action={{ href: "/assessment", label: "Start free assessment" }} />; }
