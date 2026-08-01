import type { Metadata } from "next";
import { ArrowRight, Check, CircleAlert, FileCheck2, Gauge, ShieldCheck, Sparkles, TrendingUp, Zap } from "lucide-react";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { PublicStatePanel } from "@/components/ui/public-state-panel";
import { RESULT_DISCLAIMER } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { trackServerEvent } from "@/lib/server-analytics";
import { verifyAccessToken } from "@/lib/security/tokens";
import { formatInr } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your Loan Matches", robots: { index: false, follow: false } };

const creditLabels: Record<string, string> = {
  BELOW_550: "Below 550", "550_599": "550–599", "600_649": "600–649",
  "650_699": "650–699", "700_749": "700–749", "750_PLUS": "750+", UNKNOWN: "Not known",
};

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
  const strengths = asStringArray(score.strengths);
  const improvements = asStringArray(score.improvements);
  const offer = indicativeOffer(assessment.creditRange ?? "UNKNOWN", Number(assessment.monthlyIncome ?? 0), Number(assessment.loanAmount ?? 0));

  await Promise.all([
    prisma.lead.update({ where: { id: assessment.leadId }, data: { stage: "FREE_RESULT_VIEWED" } }),
    trackServerEvent("free_result_viewed", { leadId: assessment.leadId, page: `/result/${id}` }),
  ]).catch(() => undefined);

  const checkoutUrl = `/checkout?product=credit-health-action-plan&assessment=${id}&token=${encodeURIComponent(token)}`;

  return (
    <section className="surface-grid min-h-screen bg-surface py-8 sm:py-14">
      <div className="page-shell">
        <div className="mx-auto max-w-6xl">
          <div className="relative overflow-hidden rounded-[2.25rem] bg-navy-950 p-7 text-white shadow-card sm:p-11">
            <div className="absolute -right-20 -top-28 h-80 w-80 rounded-full bg-brand-500/20 blur-3xl" />
            <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-brand-500">Your profile-based result</p>
                <h1 className="mt-4 max-w-3xl text-balance text-4xl font-black tracking-[-0.055em] sm:text-6xl">You may qualify for an indicative offer of {offer.amount}.</h1>
                <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300">Calculated from your stated income, current obligations, requested amount and self-reported CIBIL range. Final offers are issued only by the lender after verification.</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur lg:min-w-56 lg:text-right">
                <p className="text-xs font-semibold text-slate-300">Profile readiness</p>
                <p className="mt-1 text-5xl font-black tracking-[-0.06em] text-brand-500">{score.readinessScore}<span className="text-lg text-slate-400">/100</span></p>
                <p className="mt-2 text-sm font-extrabold">{score.readinessLabel}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatusCard icon={ShieldCheck} label="Self-reported CIBIL range" value={creditLabels[assessment.creditRange ?? "UNKNOWN"] ?? "Not known"} />
            <StatusCard icon={TrendingUp} label="Existing EMI burden" value={score.emiBurden} />
            <StatusCard icon={FileCheck2} label="Document readiness" value={score.documentationStatus} />
            <StatusCard icon={Gauge} label="Indicative interest band" value={offer.rate} />
          </div>

          <div className="mt-5 overflow-hidden rounded-[2.25rem] border border-brand-500/30 bg-white shadow-card">
            <div className="grid lg:grid-cols-[1.1fr_0.75fr]">
              <div className="p-7 sm:p-10">
                <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-4 py-2 text-xs font-extrabold text-brand-700"><Sparkles size={15} />Recommended next step</span>
                <h2 className="mt-5 text-balance text-3xl font-black tracking-[-0.045em] text-navy-950 sm:text-4xl">Unlock your ₹199 Credit & Loan Match Plan</h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">Get a focused credit-improvement action plan, application-readiness checklist and verified digital loan platforms matched to your profile. This plan does not change your bureau score instantly and does not guarantee approval.</p>
                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  {["Profile-matched short-term loan options", "Credit improvement action checklist", "Estimated amount and affordability view", "Verified lender or LSP application links"].map((item) => <p key={item} className="flex items-start gap-2 text-sm font-semibold text-slate-700"><Check className="mt-0.5 shrink-0 text-brand-600" size={17} />{item}</p>)}
                </div>
              </div>
              <div className="bg-navy-950 p-7 text-white sm:p-10">
                <Zap className="text-brand-500" size={28} />
                <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-slate-300">One-time access</p>
                <p className="mt-2 text-5xl font-black text-brand-500">₹199 <span className="text-base text-slate-300">+ GST</span></p>
                <p className="mt-2 text-sm font-bold">Total payable: ₹234.82</p>
                <ButtonLink href={checkoutUrl} size="lg" className="mt-7 w-full">Unlock My Matches <ArrowRight size={18} /></ButtonLink>
                <p className="mt-4 text-xs leading-6 text-slate-400">Fee is for the digital assessment, action plan and access to matched options—not a lender fee or loan approval fee.</p>
              </div>
            </div>
          </div>

          {assessment.creditRange === "UNKNOWN" ? <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-6"><h2 className="font-extrabold text-amber-950">Your actual CIBIL score is not available</h2><p className="mt-2 text-sm leading-6 text-amber-900">Your result uses a neutral estimate. Check your official free annual CIBIL report before applying.</p><a className="mt-4 inline-flex font-extrabold text-amber-950 underline" href="https://www.cibil.com/freecibilscore" target="_blank" rel="noreferrer">Check on official CIBIL website</a></div> : null}

          <details className="mt-5 rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-8">
            <summary className="cursor-pointer font-extrabold text-navy-950">View profile strengths and action points</summary>
            <div className="mt-7 grid gap-6 lg:grid-cols-2"><ResultList title="Profile strengths" items={strengths} positive /><ResultList title="Before you apply" items={improvements} /></div>
          </details>

          <div className="mt-5 flex items-start gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-950"><CircleAlert className="mt-1 shrink-0" size={20} /><p>{RESULT_DISCLAIMER}</p></div>
        </div>
      </div>
    </section>
  );
}

function indicativeOffer(creditRange: string, income: number, requested: number) {
  const creditCap: Record<string, number> = { BELOW_550: 10000, "550_599": 25000, "600_649": 50000, "650_699": 100000, "700_749": 300000, "750_PLUS": 500000, UNKNOWN: 25000 };
  const rate: Record<string, string> = { BELOW_550: "Varies by lender", "550_599": "18%–36% p.a.", "600_649": "16%–32% p.a.", "650_699": "14%–28% p.a.", "700_749": "11.99%–24% p.a.", "750_PLUS": "9.99%–20% p.a.", UNKNOWN: "Subject to verification" };
  const capacity = Math.max(5000, Math.round((income * 5) / 5000) * 5000);
  const upper = Math.max(5000, Math.min(requested || creditCap[creditRange] || 25000, creditCap[creditRange] || 25000, capacity));
  const lower = upper <= 10000 ? 5000 : Math.max(10000, Math.round((upper * 0.4) / 5000) * 5000);
  return { amount: `${formatInr(lower)}–${formatInr(upper)}`, rate: rate[creditRange] || rate.UNKNOWN };
}
function asStringArray(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function StatusCard({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) { return <div className="rounded-3xl border border-line bg-white p-5 shadow-sm"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-100 text-brand-700"><Icon size={19} /></span><p className="mt-4 text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 font-extrabold text-navy-950">{value}</p></div>; }
function ResultList({ title, items, positive }: { title: string; items: string[]; positive?: boolean }) { return <div><h3 className="font-extrabold text-navy-950">{title}</h3><div className="mt-4 grid gap-3">{items.map((item) => <p key={item} className="flex items-start gap-2 text-sm leading-6 text-slate-600"><Check className={positive ? "mt-1 shrink-0 text-brand-600" : "mt-1 shrink-0 text-amber-600"} size={15} />{item}</p>)}</div></div>; }
function AccessDenied() { return <PublicStatePanel icon={ShieldCheck} title="Secure result link required" description="This link is invalid or has expired. Please complete the assessment again." action={{ href: "/assessment", label: "Start assessment" }} />; }
