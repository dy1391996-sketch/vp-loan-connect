import { PageHeader } from "@/components/ui/primitives";
import { DateTime, EmptyOrTable, LinkCell, Money, ScrollTable, StatusBadge, Td, Th } from "@/components/command/page-kit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function LeadsPage() {
  await requirePermission("leads:manage");
  const leads = await prisma.lead.findMany({
    include: { customer: true, assignedStaff: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Leads" description="Qualified and unqualified enquiries with temperature, stage and booking probability." />
      <EmptyOrTable count={leads.length} title="No leads yet" description="Website, WhatsApp, Instagram and manual leads will appear here once captured.">
        <ScrollTable>
          <thead>
            <tr>
              <Th>Lead</Th>
              <Th>Customer</Th>
              <Th>Stage</Th>
              <Th>Temp</Th>
              <Th>Probability</Th>
              <Th>Budget</Th>
              <Th>Last contact</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {leads.map((lead) => (
              <tr key={lead.id}>
                <Td><LinkCell href={`/leads/${lead.id}`}>{lead.name ?? lead.phone ?? lead.customer.name ?? "Lead"}</LinkCell></Td>
                <Td>{lead.customer.name ?? lead.customer.phone ?? "Guest"}</Td>
                <Td><StatusBadge value={lead.stage} /></Td>
                <Td><StatusBadge value={lead.temperature} /></Td>
                <Td>{lead.bookingProbability}%</Td>
                <Td><Money value={lead.budgetInr} /></Td>
                <Td><DateTime value={lead.lastContactAt} /></Td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      </EmptyOrTable>
    </div>
  );
}
