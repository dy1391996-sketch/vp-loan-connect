import type { Metadata } from "next";
import { CheckCircle2, Download, FileText, LockKeyhole } from "lucide-react";
import { prisma } from "@/lib/db";
import { verifyAccessToken } from "@/lib/security/tokens";
import { PublicStatePanel } from "@/components/ui/public-state-panel";
import { ReportActions } from "@/components/report-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Secure Report", robots: { index: false, follow: false } };

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

  const report = await prisma.report.findUnique({ where: { id }, include: { lead: true, order: { include: { product: true } } } });
  if (
    !report
    || report.order.status !== "PAID"
    || access.leadId !== report.leadId
    || access.orderId !== report.orderId
  ) return <InvalidReport />;
  if (report.status === "QUEUED") await prisma.report.update({ where: { id }, data: { status: "READY", generatedAt: new Date() } });

  return (
    <section className="surface-grid min-h-[75vh] bg-surface py-14 sm:py-18">
      <div className="page-shell">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-line/80 bg-white p-7 shadow-soft sm:p-10">
          <div className="flex items-start justify-between gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-3xl bg-brand-100 text-brand-700"><FileText size={26} /></span>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3.5 py-2 text-xs font-extrabold text-brand-700"><CheckCircle2 size={14} />Ready</span>
          </div>
          <p className="mt-7 text-xs font-extrabold uppercase tracking-[0.2em] text-brand-700">Secure report delivery</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.045em] text-navy-950 sm:text-4xl">Your personalized report</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">{report.order.product.name} prepared for {report.lead.fullName}</p>

          <div className="mt-7 rounded-3xl bg-surface p-5 sm:p-6">
            <p className="text-xs font-semibold text-slate-500">Report reference</p>
            <p className="mt-1 text-lg font-extrabold tracking-[-0.02em] text-navy-950">{report.reportReference}</p>
          </div>
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-line p-4 text-sm leading-7 text-slate-600">
            <LockKeyhole className="mt-1 shrink-0 text-brand-700" size={18} />
            This signed link expires. Do not forward a report containing your personal assessment.
          </div>
          <a href={`/api/reports/${id}/download?token=${encodeURIComponent(token)}`} className="mt-7 flex min-h-15 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-6 font-extrabold text-white shadow-[0_12px_32px_rgba(10,146,101,0.27)] transition hover:-translate-y-0.5 hover:bg-brand-700">
            <Download size={18} />Download branded PDF
          </a>
          <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs leading-5 text-slate-500"><CheckCircle2 size={14} className="shrink-0 text-brand-600" />Hindi and English font subsets are embedded for mobile-safe rendering.</p>
          <ReportActions reportId={id} token={token} />
        </div>
      </div>
    </section>
  );
}

function InvalidReport() {
  return <PublicStatePanel icon={LockKeyhole} eyebrow="Protected report" title="Secure report access required" description="This link is invalid, expired or not linked to a paid report." action={{ href: "/contact", label: "Contact support" }} />;
}
