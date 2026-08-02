import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/primitives";
import { DateTime, EmptyOrTable, KeyValueGrid, LinkCell, Money, ScrollTable, StatusBadge, Td, Th } from "@/components/command/page-kit";
import { LeadStageSelect } from "@/components/command/lead-stage-select";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("leads:manage");
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      customer: true,
      activities: { orderBy: { createdAt: "desc" }, take: 25 },
      bookings: { include: { studio: true }, orderBy: { createdAt: "desc" } },
      followUps: { orderBy: { scheduledAt: "desc" } },
    },
  });
  if (!lead) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={lead.name ?? lead.customer.name ?? "Lead detail"} description="Lead profile, stage controls, customer context, bookings and follow-up history." />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <KeyValueGrid
          items={[
            { label: "Customer", value: lead.customer.name ?? lead.customer.phone ?? "Guest" },
            { label: "Phone", value: lead.phone ?? lead.customer.phone ?? "-" },
            { label: "Source", value: lead.source.replaceAll("_", " ") },
            { label: "Temperature", value: <StatusBadge value={lead.temperature} /> },
            { label: "Probability", value: `${lead.bookingProbability}%` },
            { label: "Required date", value: <DateTime value={lead.requiredDate} /> },
            { label: "Duration", value: lead.durationHours ? `${lead.durationHours}h` : "-" },
            { label: "Budget", value: <Money value={lead.budgetInr} /> },
            { label: "Summary", value: lead.conversationSummary ?? "No summary yet" },
          ]}
        />
        <LeadStageSelect leadId={lead.id} stage={lead.stage} />
      </div>

      <section>
        <h2 className="mb-3 font-display text-xl text-ink-950">Bookings</h2>
        <EmptyOrTable count={lead.bookings.length} title="No bookings from this lead" description="Drafts created from this enquiry will be shown here.">
          <ScrollTable>
            <thead><tr><Th>Reference</Th><Th>Studio</Th><Th>Check-in</Th><Th>Status</Th></tr></thead>
            <tbody className="divide-y divide-line">
              {lead.bookings.map((booking) => (
                <tr key={booking.id}>
                  <Td><LinkCell href={`/bookings/${booking.id}`}>{booking.reference}</LinkCell></Td>
                  <Td>{booking.studio.number}</Td>
                  <Td><DateTime value={booking.checkInAt} /></Td>
                  <Td><StatusBadge value={booking.status} /></Td>
                </tr>
              ))}
            </tbody>
          </ScrollTable>
        </EmptyOrTable>
      </section>
    </div>
  );
}
