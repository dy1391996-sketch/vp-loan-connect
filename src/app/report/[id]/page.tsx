import type { Metadata } from "next";
import { CheckCircle2, Download, FileText, LockKeyhole } from "lucide-react";
import { prisma } from "@/lib/db";
import { continueQuickApplyHref } from "@/lib/domain/early-checkout";
import { signAccessToken, verifyAccessToken } from "@/lib/security/tokens";
import { PublicStatePanel } from "@/components/ui/public-state-panel";
import { ReportActions } from "@/components/report-actions";
import { ConnectOptionsPanel } from "@/components/connect-options-panel";
import { getPaidConnectBundle } from "@/lib/matching/match-service";

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
  if (report.status === "QUEUED" && report.assessment.score) await prisma.report.update({ where: { id }, data: { status: "READY", generatedAt: new Date() } });

  const score = report.assessment.score;
  const pendingProfile = !score;
  const continueToken = await signAccessToken("result_access", report.assessmentId, { leadId: report.leadId }, "7d");
  const continueHref = continueQuickApplyHref(report.assessmentId, continueToken);
  const suitableCategories = Array.isArray(score?.suitableCategories)
    ? score.suitableCategories.filter((item): item is string => typeof item === "string")
    : [];

  const { matched, more } = pendingProfile
    ? { matched: [], more: [] }
    : await getPaidConnectBundle({
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
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3.5 py-2 text-xs font-extrabold text-brand-700">
                <CheckCircle2 size={14} />Credit Profile Booster unlocked
              </span>
            </div>
            <p className="mt-7 text-xs font-extrabold uppercase tracking-[0.2em] text-brand-700">Secure profile report</p>
            <h1 className="font-display mt-3 text-3xl font-black tracking-[-0.045em] text-navy-950 sm:text-5xl">
              {pendingProfile ? "Booster unlocked — finish your profile" : "Your loan-connect options are ready."}
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">{report.order.product.name} · Reference: {report.reportReference}</p>
            {pendingProfile ? (
              <a
                href={continueHref}
                className="mt-7 flex min-h-15 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-6 font-extrabold text-white shadow-[0_12px_32px_rgba(10,146,101,0.27)] transition hover:-translate-y-0.5 hover:bg-brand-700"
              >
                Continue detailed application
              </a>
            ) : (
              <>
                <a
                  href={`/api/reports/${id}/download?token=${encodeURIComponent(token)}`}
                  className="mt-7 flex min-h-15 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-6 font-extrabold text-white shadow-[0_12px_32px_rgba(10,146,101,0.27)] transition hover:-translate-y-0.5 hover:bg-brand-700"
                >
                  <Download size={18} />Download detailed action plan
                </a>
                <ReportActions reportId={id} token={token} />
              </>
            )}
          </div>

          <div className="mt-6">
            {pendingProfile ? (
              <div className="rounded-[2rem] border border-line bg-white p-7 shadow-soft">
                <h2 className="text-2xl font-extrabold text-navy-950">Complete your profile to unlock matches</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Payment is verified. Finish PAN, address and work details so we can generate your result and matched official lender links.
                </p>
                <a
                  href={continueHref}
                  className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-brand-600 px-6 font-extrabold text-white"
                >
                  Continue detailed application
                </a>
              </div>
            ) : (
              <ConnectOptionsPanel matched={matched} more={more} />
            )}
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
