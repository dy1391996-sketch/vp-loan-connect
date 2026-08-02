import { PageHeader } from "@/components/ui/primitives";
import { DateOnly, DateTime, EmptyOrTable, JsonBlock, ScrollTable, Td, Th } from "@/components/command/page-kit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function DailyReportsPage() {
  await requirePermission("analytics:view");
  const reports = await prisma.dailyReport.findMany({ orderBy: { reportDate: "desc" }, take: 60 });
  return (
    <div className="space-y-6">
      <PageHeader title="Daily reports" description="Stored AI-generated daily business snapshots." />
      <EmptyOrTable count={reports.length} title="No daily reports" description="The daily-report cron endpoint will create DailyReport rows after it runs.">
        <ScrollTable>
          <thead><tr><Th>Date</Th><Th>Summary</Th><Th>Delivered</Th><Th>Payload</Th></tr></thead>
          <tbody className="divide-y divide-line">
            {reports.map((report) => (
              <tr key={report.id}>
                <Td><DateOnly value={report.reportDate} /></Td>
                <Td className="max-w-lg whitespace-normal">{report.summary}</Td>
                <Td><DateTime value={report.deliveredAt} /></Td>
                <Td className="min-w-80"><JsonBlock value={report.payload} /></Td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      </EmptyOrTable>
    </div>
  );
}
