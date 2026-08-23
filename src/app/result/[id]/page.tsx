import type { Metadata } from "next";
import { Check, CircleAlert, FileCheck2, Gauge, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { PublicStatePanel } from "@/components/ui/public-state-panel";
import { RESULT_DISCLAIMER, USP_PRODUCT_SLUG } from "@/lib/constants";
import { continueQuickApplyHref } from "@/lib/domain/early-checkout";
import { prisma } from "@/lib/db";
import { readBoosterEntitlement } from "@/lib/payments/entitlement";
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
  let payload;
  try {
    payload = await verifyAccessToken(token, "result_access");
    if (payload.sub !== id || typeof payload.leadId !== "string") return <AccessDenied />;
  } catch { return <AccessDenied />; }

  const entitlement = await readBoosterEntitlement(id, payload.leadId);
  if (!entitlement?.paid) {
    redirect(`/checkout?product=${USP_PRODUCT_SLUG}&assessment=${id}&token=${encodeURIComponent(token)}`);
  }
  if (!entitlement?.hasScore) {
    redirect(continueQuickApplyHref(id, token));
  }

  const assessment = await prisma.assessment.findUnique({ where: { id }, include: { lead: true, score: true } });
  if (!assessment?.score || assessment.lead.deletedAt) notFound();
  const score = assessment.score;
  const strengths = asStringArray(score.strengths);
  const improvements = asStringArray(score.improvements);
  const offer = indicativeOffer(assessment.creditRange ?? "UNKNOWN", Number(assessment.monthlyIncome ?? 0), Number(assessment.loanAmount ?? 0));

  await Promise.all([
    prisma.lead.update({ where: { id: assessment.leadId }, data: { stage: "REPORT_DELIVERED" } }),
    trackServerEvent("result_viewed", { leadId: assessment.leadId, page: `/result/${id}` }),
    trackServerEvent("matched_options_viewed", { leadId: assessment.leadId, page: `/result/${id}` }),
  ]).catch(() => undefined);

  return (
    <section className="surface-grid min-h-screen bg-surface py-8 sm:py-14">
      <div className="page-shell">
        <div className="mx-auto max-w-6xl">
          <div className="relative overflow-hidden rounded-[2.25rem] bg-navy-950 p-7 text-white shadow-card sm:p-11">
            <div className="absolute -right-20 -top-28 h-80 w-80 rounded-full bg-brand-500/20 blur-3xl" />
            <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-brand-500">Your preliminary loan profile</p>
                <h1 className="mt-4 max-w-3xl text-balance text-4xl font-black tracking-[-0.055em] sm:text-6xl">Your preliminary loan profile is ready</h1>
                <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300">
                  Indicative amount band {offer.amount} from your stated income, obligations and self-reported CIBIL range.
                  This is not a lender approval and not a bureau score. Final approval, APR, amount and tenure are decided by the lender.
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur lg:min-w-56 lg:text-right">
                <p className="text-xs font-semibold text-slate-300">Readiness band</p>
                <p className="mt-1 text-5xl font-black tracking-[-0.06em] text-brand-500">{score.readinessScore}<span className="text-lg text-slate-400">/100</span></p>
                <p className="mt-2 text-sm font-extrabold">{score.readinessLabel}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatusCard icon={ShieldCheck} label="Self-reported CIBIL range" value={creditLabels[assessment.creditRange ?? "UNKNOWN"] ?? "Not known"} />
            <StatusCard icon={TrendingUp} label="Existing EMI burden" value={score.emiBurden} />
            <StatusCard icon={FileCheck2} label="Document readiness" value={score.documentationStatus} />
            <StatusCard icon={Gauge} label="Educational interest estimate only" value={offer.rate} />
          </div>

          <div className="mt-5 overflow-hidden rounded-[2.25rem] border border-brand-500/30 bg-white shadow-card">
            <div className="grid lg:grid-cols-[1.1fr_0.75fr]">
              <div className="p-7 sm:p-10">
                <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-4 py-2 text-xs font-extrabold text-brand-700"><Sparkles size={15} />Credit Profile Booster unlocked</span>
                <h2 className="mt-5 text-balance text-3xl font-black tracking-[-0.045em] text-navy-950 sm:text-4xl">Your paid profile analysis is ready</h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">This is a profile-readiness result, not a lender approval. Interest rate, eligibility and disbursement depend on the lender&apos;s criteria, documentation and internal policies. VP Loan Connect is not a lender.</p>
                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  {["Credit profile explained simply", "Loan-readiness analysis", "Profile-fit options shown first (not endorsements)", "Official apply links — no random sites"].map((item) => <p key={item} className="flex items-start gap-2 text-sm font-semibold text-slate-700"><Check className="mt-0.5 shrink-0 text-brand-600" size={17} />{item}</p>)}
                </div>
              </div>
              <div className="bg-navy-950 p-7 text-white sm:p-10">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">Requested amount</p>
                <p className="mt-2 text-4xl font-black text-brand-500">{formatInr(Number(assessment.loanAmount ?? 0))}</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">Matched options appear with your completed paid profile. This does not guarantee approval or disbursement.</p>
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
function AccessDenied() { return <PublicStatePanel icon={ShieldCheck} title="Secure result link required" description="This link is invalid or has expired. Start from Quick Apply to verify email and unlock the Credit Profile Booster." action={{ href: "/apply/quick", label: "Start Quick Apply" }} />; }
