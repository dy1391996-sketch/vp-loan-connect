import { PageHeader, Badge } from "@/components/ui/primitives";
import { DateTime, EmptyOrTable, ScrollTable, StatusBadge, Td, Th, LinkCell } from "@/components/command/page-kit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function FollowUpsPage() {
  await requirePermission("bookings:manage");
  const followUps = await prisma.followUp.findMany({
    include: { customer: true, lead: true },
    orderBy: [{ status: "asc" }, { scheduledAt: "asc" }],
    take: 100,
  });
  const due = followUps.filter((f) => f.status === "SCHEDULED" && f.scheduledAt <= new Date()).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Follow-ups"
        description="Automated reminders respect opt-outs, max attempts, and WhatsApp 24-hour messaging windows (templates outside the window)."
        actions={<Badge tone="warn">{due} due now</Badge>}
      />
      <EmptyOrTable count={followUps.length} title="No follow-ups" description="Follow-ups are scheduled when prices are shared, payment links are sent, or pre-arrival workflows run.">
        <ScrollTable>
          <thead>
            <tr>
              <Th>Customer</Th>
              <Th>Type</Th>
              <Th>Status</Th>
              <Th>Scheduled</Th>
              <Th>Attempts</Th>
              <Th>Lead</Th>
              <Th>Template</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {followUps.map((f) => (
              <tr key={f.id}>
                <Td>{f.customer.name ?? f.customer.phone ?? "Guest"}</Td>
                <Td>{f.type.replaceAll("_", " ")}</Td>
                <Td>
                  <StatusBadge value={f.status} />
                </Td>
                <Td>
                  <DateTime value={f.scheduledAt} />
                </Td>
                <Td>
                  {f.attempt}/{f.maxAttempts}
                </Td>
                <Td>{f.leadId ? <LinkCell href={`/leads/${f.leadId}`}>{f.lead?.stage ?? "Lead"}</LinkCell> : "—"}</Td>
                <Td>{f.templateKey ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      </EmptyOrTable>
    </div>
  );
}
