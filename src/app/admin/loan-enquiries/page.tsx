import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { redactMobile } from "@/lib/utils";

export const dynamic = "force-dynamic";

function utmLabel(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "—";
  const record = value as Record<string, unknown>;
  const campaign = typeof record.utm_campaign === "string" ? record.utm_campaign : "";
  const content = typeof record.utm_content === "string" ? record.utm_content : "";
  return [campaign, content].filter(Boolean).join(" · ") || "—";
}

export default async function AdminLoanEnquiriesPage() {
  const { admin } = await requireAdmin();
  const enquiries = await prisma.loanAssistanceEnquiry.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <AdminShell
      title="Loan assistance enquiries"
      description="Instagram loan-assistance form submissions. Test rows are marked and are not customer enquiries. Mobile numbers are partly hidden in this list."
      adminName={admin.fullName}
    >
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-surface text-xs text-slate-500">
            <tr>
              <th className="px-5 py-4">Reference</th>
              <th className="px-5 py-4">Name</th>
              <th className="px-5 py-4">Mobile</th>
              <th className="px-5 py-4">Location</th>
              <th className="px-5 py-4">Category</th>
              <th className="px-5 py-4">Campaign</th>
              <th className="px-5 py-4">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {enquiries.map((enquiry) => (
              <tr key={enquiry.id} className="hover:bg-surface/60">
                <td className="px-5 py-4 font-mono text-xs font-bold text-navy-950">
                  {enquiry.publicRef}
                  {enquiry.isTest ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-1 font-sans text-[10px] font-bold text-amber-800">TEST</span> : null}
                </td>
                <td className="px-5 py-4 font-bold text-navy-950">{enquiry.fullName}</td>
                <td className="px-5 py-4 text-slate-600">{redactMobile(enquiry.mobile)}</td>
                <td className="px-5 py-4 text-slate-600">{enquiry.city}, {enquiry.state}</td>
                <td className="px-5 py-4 text-slate-600">{enquiry.loanType}</td>
                <td className="px-5 py-4 text-slate-600">{utmLabel(enquiry.utm)}</td>
                <td className="px-5 py-4 text-slate-600">{enquiry.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {enquiries.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No loan-assistance enquiries yet.</p> : null}
      </div>
    </AdminShell>
  );
}
