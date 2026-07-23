import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { formatInr } from "@/lib/utils";

export const dynamic = "force-dynamic";
export default async function AdminDashboardPage() {
  const { admin } = await requireAdmin();
  const [leads, completed, paid, reportQueue, revenue] = await Promise.all([prisma.lead.count({ where: { deletedAt: null } }), prisma.assessment.count({ where: { status: "COMPLETED" } }), prisma.order.count({ where: { status: "PAID" } }), prisma.report.count({ where: { status: { in: ["QUEUED", "PROCESSING"] } } }), prisma.order.aggregate({ where: { status: "PAID" }, _sum: { totalAmount: true } })]);
  return <AdminShell title="Operations overview" description="Consent-aware lead, payment and report operations." adminName={admin.fullName}><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><Metric label="Active leads" value={String(leads)} /><Metric label="Assessments" value={String(completed)} /><Metric label="Paid orders" value={String(paid)} /><Metric label="Reports queued" value={String(reportQueue)} /><Metric label="Captured value" value={formatInr(Number(revenue._sum.totalAmount ?? 0))} /></div><div className="mt-6 rounded-2xl border border-line bg-white p-6"><h2 className="font-bold text-navy-950">Operational guardrails</h2><ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-600 sm:grid-cols-2"><li>• Marketing outreach requires valid optional consent.</li><li>• CSV export is restricted to Admin/Super Admin.</li><li>• Lenders remain hidden until all verification flags pass.</li><li>• Reports require paid orders and secure access links.</li></ul></div></AdminShell>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-line bg-white p-5"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-2xl font-extrabold tracking-[-0.03em] text-navy-950">{value}</p></div>; }
