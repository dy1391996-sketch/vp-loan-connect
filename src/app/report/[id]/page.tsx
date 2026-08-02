import type { Metadata } from "next";
import { ArrowUpRight, CheckCircle2, Download, FileText, Landmark, LockKeyhole, Sparkles } from "lucide-react";
import { prisma } from "@/lib/db";
import { verifyAccessToken } from "@/lib/security/tokens";
import { PublicStatePanel } from "@/components/ui/public-state-panel";
import { ReportActions } from "@/components/report-actions";
import { PartnerHandoffLink } from "@/components/partner-handoff-link";
import { getProfileMatchedOptions } from "@/lib/matching/match-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your Credit Profile Booster", robots: { index: false, follow: false } };

export default async function ReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) {
  const { id } = await params;
  const { token } = await searchParams;
  if (!token) return <InvalidReport />;
  let access;
  try {
    access = await verifyAccessToken(token, "report_access");
    if (access.sub !== id) throw new Error("mismatch");
  } catch {
    return <InvalidReport />;
  }

  const report = await prisma.report.findUnique({
    where: { id },
    include: { lead: true, assessment: { include: { score: true } }, order: { include: { product: true } } },
  });
  if (!report || report.order.status !== "PAID" || access.leadId !== report.leadId || access.orderId !== report.orderId) return <InvalidReport />;
  if (report.status === "QUEUED") await prisma.report.update({ where: { id }, data: { status: "READY", generatedAt: new Date() } });

  const score = report.assessment.score;
  const suitableCategories = Array.isArray(score?.suitableCategories)
    ? score.suitableCategories.filter((item): item is string => typeof item === "string")
    : [];

  const options = await getProfileMatchedOptions({
    loanAmount: Number(report.assessment.loanAmount ?? 0),
    loanType: report.assessment.loanType ?? "PERSONAL",
    employmentType: report.assessment.employmentType ?? "OTHER",
    creditRange: report.assessment.creditRange ?? "UNKNOWN",
    existingEmi: Number(report.assessment.existingEmi ?? 0),
    monthlyIncome: Number(report.assessment.monthlyIncome ?? 0),
    readinessScore: score?.readinessScore ?? 50,
    emiBurden: score?.emiBurden ?? "Moderate",
    documentationStatus: score?.documentationStatus ?? "Partial",
    suitableCategories,
  });

  return (
    <section className="surface-grid min-h-[75vh] bg-surface py-10 sm:py-16">
      <div className="page-shell">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-[2.25rem] border border-line/80 bg-white p-7 shadow-soft sm:p-10">
            <div className="flex items-start justify-between gap-4">
              <span className="grid h-14 w-14 place-items-center rounded-3xl bg-brand-100 text-brand-700"><FileText size={26} /></span>
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3.5 py-2 text-xs font-extrabold text-brand-700"><CheckCircle2 size={14} />Credit Profile Booster unlocked</span>
            </div>
            <p className="mt-7 text-xs font-extrabold uppercase tracking-[0.2em] text-brand-700">Secure profile report</p>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.045em] text-navy-950 sm:text-5xl">Your profile-matched loan options are ready.</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">{report.order.product.name} · Reference: {report.reportReference}</p>
            <a href={`/api/reports/${id}/download?token=${encodeURIComponent(token)}`} className="mt-7 flex min-h-15 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-6 font-extrabold text-white shadow-[0_12px_32px_rgba(10,146,101,0.27)] transition hover:-translate-y-0.5 hover:bg-brand-700">
              <Download size={18} />Download detailed action plan
            </a>
            <ReportActions reportId={id} token={token} />
          </div>

          <div className="mt-6 rounded-[2.25rem] bg-navy-950 p-7 text-white shadow-card sm:p-10">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-500/15 text-brand-500"><Landmark size={23} /></span>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-500">Ranked by profile fit</p>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">Best-fit options shown first</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                  Stronger profiles unlock stronger matches. Choose one suitable official platform and complete its own eligibility check.
                  We do not submit your details automatically. The regulated lender—not VP Loan Connect—sets the final amount, APR, fees, tenure and decision.
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {options.map((option) => (
                <PartnerHandoffLink
                  key={option.id}
                  href={option.href}
                  name={option.name}
                  className="group rounded-3xl border border-white/10 bg-white/8 p-6 transition hover:-translate-y-0.5 hover:border-brand-500/50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.15em] text-brand-500">
                      {option.fitLabel === "Best profile fit" ? <><Sparkles size={15} />{option.fitLabel}</> : option.fitLabel}
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-200">Fit {option.fitScore}</span>
                    </span>
                    <ArrowUpRight className="text-slate-400 transition group-hover:text-brand-500" size={20} />
                  </div>
                  <h3 className="mt-5 text-xl font-extrabold">{option.name}</h3>
                  <p className="mt-1 text-xs font-semibold text-slate-400">{option.productName} · {option.category}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{option.description}</p>
                  <ul className="mt-3 grid gap-1.5">
                    {option.reasons.map((reason) => (
                      <li key={reason} className="text-xs leading-5 text-slate-400">• {reason}</li>
                    ))}
                  </ul>
                  <p className="mt-4 rounded-xl bg-white/5 p-3 text-xs leading-5 text-slate-400">{option.disclosure}</p>
                  <p className="mt-4 text-xs font-bold text-brand-500">Continue to official platform</p>
                </PartnerHandoffLink>
              ))}
            </div>

            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 text-xs leading-6 text-slate-300">
              <LockKeyhole className="mt-0.5 shrink-0 text-brand-500" size={17} />
              Avoid applying on several platforms at once. Each application may create a credit enquiry. Review the lender name, Key Fact Statement, APR, total charges and repayment schedule before accepting any loan.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function InvalidReport() {
  return (
    <PublicStatePanel
      icon={LockKeyhole}
      eyebrow="Secure report"
      title="A valid access link is required"
      description="This link is invalid, expired or does not match a paid report."
      action={{ href: "/contact", label: "Contact support" }}
    />
  );
}
