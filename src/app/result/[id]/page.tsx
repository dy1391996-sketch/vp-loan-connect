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
export const metadata: Metadata = { title: "आपकी Loan Profile का Result", robots: { index: false, follow: false } };

const creditLabels: Record<string, string> = {
  BELOW_550: "550 से कम",
  "550_599": "550–599",
  "600_649": "600–649",
  "650_699": "650–699",
  "700_749": "700–749",
  "750_PLUS": "750 या अधिक",
  UNKNOWN: "अभी पता नहीं",
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
  const categories = asStringArray(score.suitableCategories);
  const strengths = asStringArray(score.strengths);
  const improvements = asStringArray(score.improvements);

  await Promise.all([
    prisma.lead.update({ where: { id: assessment.leadId }, data: { stage: "FREE_RESULT_VIEWED" } }),
    trackServerEvent("free_result_viewed", { leadId: assessment.leadId, page: `/result/${id}` }),
  ]).catch(() => undefined);

  const checkoutUrl = `/checkout?product=credit-health-action-plan&assessment=${id}&token=${encodeURIComponent(token)}`;

  return (
    <section className="surface-grid min-h-screen bg-surface py-8 sm:py-14">
      <div className="page-shell">
        <div className="mx-auto max-w-5xl">
          <div className="relative overflow-hidden rounded-[2rem] bg-navy-950 p-6 text-white shadow-soft sm:p-10">
            <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand-500/15 blur-3xl" />
            <div className="relative grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-500">आपकी शुरुआती Loan Profile</p>
                <h1 className="mt-4 text-balance text-3xl font-extrabold tracking-[-0.045em] sm:text-5xl">{assessment.lead.fullName}, आपकी profile तैयार है</h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">आपके दिए गए जवाबों के आधार पर यह शुरुआती readiness result है। इससे आपकी सही दिशा तय होगी और अनावश्यक loan applications से बचने में मदद मिलेगी।</p>
              </div>
              <div className="shrink-0 rounded-3xl border border-white/10 bg-white/8 p-6 backdrop-blur lg:text-right">
                <p className="text-xs font-semibold text-slate-300">Loan Readiness Score</p>
                <p className="mt-1 text-5xl font-black tracking-[-0.06em] text-brand-500">{score.readinessScore}<span className="text-lg text-slate-400">/100</span></p>
                <p className="mt-2 text-sm font-extrabold">{hindiReadiness(score.readinessLabel)}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatusCard icon={Gauge} label="Profile पूरी हुई" value={`${assessment.completionPercent}%`} />
            <StatusCard icon={TrendingUp} label="मौजूदा EMI का दबाव" value={hindiBurden(score.emiBurden)} />
            <StatusCard icon={FileCheck2} label="Documents की तैयारी" value={hindiDocs(score.documentationStatus)} />
            <StatusCard icon={ShieldCheck} label="बताई गई CIBIL range" value={creditLabels[assessment.creditRange ?? "UNKNOWN"] ?? "अभी पता नहीं"} />
          </div>

          <div className="mt-5 rounded-[2rem] border border-brand-500/35 bg-white p-6 shadow-card sm:p-9">
            <div className="grid gap-8 lg:grid-cols-[1fr_0.78fr] lg:items-center">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-4 py-2 text-xs font-extrabold text-brand-700"><Sparkles size={15} />अगला सही कदम</span>
                <h2 className="mt-5 text-balance text-3xl font-extrabold tracking-[-0.04em] text-navy-950">₹99 में अपनी पूरी profile analysis और उपयुक्त loan options खोलें</h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">Payment के बाद आपको risk points, documents checklist, सुधार के कदम और आपकी बताई profile के अनुसार official lender application options मिलेंगे। आपकी जानकारी बिना अलग consent किसी lender को नहीं भेजी जाएगी।</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {["Profile के अनुसार loan categories", "CIBIL range के अनुसार अगला कदम", "कम rejection-risk वाली तैयारी", "Official lender application links"].map((item) => <p key={item} className="flex items-start gap-2 text-sm font-semibold text-slate-700"><Check className="mt-0.5 shrink-0 text-brand-600" size={17} />{item}</p>)}
                </div>
              </div>
              <div className="rounded-3xl bg-navy-950 p-6 text-white">
                <p className="text-xs font-bold text-slate-300">एक बार का शुल्क</p>
                <p className="mt-2 text-4xl font-black text-brand-500">₹99 <span className="text-base text-slate-300">+ GST</span></p>
                <p className="mt-1 text-sm font-bold">कुल ₹116.82</p>
                <ButtonLink href={checkoutUrl} className="mt-6 w-full">₹99 Plan खोलें <ChevronRight size={17} /></ButtonLink>
                <p className="mt-4 text-xs leading-5 text-slate-400">यह report और profile guidance का शुल्क है, loan approval या lender processing fee नहीं।</p>
              </div>
            </div>
          </div>

          {assessment.creditRange === "UNKNOWN" ? (
            <div className="mt-5 flex flex-col gap-4 rounded-3xl border border-amber-200 bg-amber-50 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="font-extrabold text-amber-950">अपना वास्तविक CIBIL score नहीं जानते?</h2><p className="mt-2 text-sm leading-6 text-amber-900">VP Loan Connect bureau score नहीं बनाता। TransUnion CIBIL हर calendar year में एक free report देता है।</p></div>
              <a className="shrink-0 rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-amber-950 shadow-sm" href="https://www.cibil.com/hi/freecibilscore" target="_blank" rel="noreferrer">Official CIBIL पर जाँचें</a>
            </div>
          ) : null}

          <details className="mt-5 rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-8">
            <summary className="cursor-pointer font-extrabold text-navy-950">पूरी free profile detail देखें</summary>
            <div className="mt-7 grid gap-5 lg:grid-cols-2">
              <InfoCard title="अनुमानित आरामदायक EMI" value={`${formatInr(Number(score.comfortableEmiMin))} – ${formatInr(Number(score.comfortableEmiMax))} प्रति माह`} />
              <InfoCard title="उपयुक्त loan categories" value={categories.join(" · ") || "Profile review आवश्यक"} />
              <ResultList title="Profile की मजबूत बातें" items={strengths} positive />
              <ResultList title="पहले सुधारने वाली बातें" items={improvements} />
            </div>
          </details>

          <div className="mt-5 flex items-start gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-950"><CircleAlert className="mt-1 shrink-0" size={20} /><p>{RESULT_DISCLAIMER}</p></div>
        </div>
      </div>
    </section>
  );
}

function asStringArray(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function hindiReadiness(value: string) { return value === "Strong readiness" ? "मजबूत profile" : value === "Moderate readiness" ? "मध्यम profile" : value === "Improvement required" ? "सुधार जरूरी" : "अधिक rejection risk"; }
function hindiBurden(value: string) { return value === "Low" ? "कम" : value === "Moderate" ? "मध्यम" : value === "High" ? "अधिक" : "बहुत अधिक"; }
function hindiDocs(value: string) { return value === "Strong" ? "पूरी" : value === "Partial" ? "कुछ बाकी" : "अधूरी"; }
function StatusCard({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) { return <div className="rounded-3xl border border-line bg-white p-5 shadow-sm"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-100 text-brand-700"><Icon size={19} /></span><p className="mt-4 text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 font-extrabold text-navy-950">{value}</p></div>; }
function InfoCard({ title, value }: { title: string; value: string }) { return <div className="rounded-2xl bg-surface p-5"><p className="text-xs font-bold text-slate-500">{title}</p><p className="mt-2 font-extrabold text-navy-950">{value}</p></div>; }
function ResultList({ title, items, positive }: { title: string; items: string[]; positive?: boolean }) { return <div><h3 className="font-extrabold text-navy-950">{title}</h3><div className="mt-4 grid gap-3">{items.map((item) => <p key={item} className="flex items-start gap-2 text-sm leading-6 text-slate-600"><Check className={positive ? "mt-1 shrink-0 text-brand-600" : "mt-1 shrink-0 text-amber-600"} size={15} />{item}</p>)}</div></div>; }
function AccessDenied() { return <PublicStatePanel icon={ShieldCheck} title="सुरक्षित result link जरूरी है" description="यह link गलत है या expire हो चुका है। कृपया assessment दोबारा पूरा करें।" action={{ href: "/assessment", label: "Assessment शुरू करें" }} />; }
