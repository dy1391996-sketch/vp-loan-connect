import { PageHeader } from "@/components/ui/primitives";
import { DateTime, EmptyOrTable, ScrollTable, StatusBadge, Td, Th } from "@/components/command/page-kit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function FollowUpsPage() {
  await requirePermission("bookings:manage");
  const followUps = await prisma.followUp.findMany({
    include: { customer: true, lead: true },
    orderBy: { scheduledAt: "asc" },
    take: 100,
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Follow-ups" description="Scheduled WhatsApp and sales follow-ups across unpaid tokens, pre-arrival, checkout and reviews." />
      <EmptyOrTable count={followUps.length} title="No follow-ups scheduled" description="AI or staff-created follow-ups will appear here with their delivery status.">
        <ScrollTable>
          <thead><tr><Th>Customer</Th><Th>Type</Th><Th>Status</Th><Th>Channel</Th><Th>Scheduled</Th><Th>Template</Th></tr></thead>
          <tbody className="divide-y divide-line">
            {followUps.map((followUp) => (
              <tr key={followUp.id}>
                <Td>{followUp.customer.name ?? followUp.customer.phone ?? "Guest"}</Td>
                <Td>{followUp.type.replaceAll("_", " ")}</Td>
                <Td><StatusBadge value={followUp.status} /></Td>
                <Td>{followUp.channel.replaceAll("_", " ")}</Td>
                <Td><DateTime value={followUp.scheduledAt} /></Td>
                <Td>{followUp.templateKey ?? "-"}</Td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      </EmptyOrTable>
    </div>
  );
}
