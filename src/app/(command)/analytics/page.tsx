import { PageHeader, StatCard } from "@/components/ui/primitives";
import { Money, ScrollTable, Td, Th } from "@/components/command/page-kit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatInr } from "@/lib/utils";

export default async function AnalyticsPage() {
  await requirePermission("analytics:view");
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [leadCount, bookingCount, paidRevenue, monthRevenue, averageBooking, bookingStatuses, leadStages, topStudios] = await Promise.all([
    prisma.lead.count(),
    prisma.booking.count(),
    prisma.payment.aggregate({ where: { status: "PAID" }, _sum: { amountInr: true } }),
    prisma.payment.aggregate({ where: { status: "PAID", paidAt: { gte: monthStart } }, _sum: { amountInr: true } }),
    prisma.booking.aggregate({ _avg: { totalAmountInr: true } }),
    prisma.booking.groupBy({ by: ["status"], _count: { _all: true }, orderBy: { _count: { status: "desc" } } }),
    prisma.lead.groupBy({ by: ["stage"], _count: { _all: true }, orderBy: { _count: { stage: "desc" } } }),
    prisma.booking.groupBy({ by: ["studioId"], _count: { _all: true }, _sum: { totalAmountInr: true }, orderBy: { _count: { studioId: "desc" } }, take: 10 }),
  ]);
  const studios = await prisma.studio.findMany({ where: { id: { in: topStudios.map((item) => item.studioId) } }, select: { id: true, number: true, title: true } });
  const studioMap = new Map(studios.map((studio) => [studio.id, studio]));

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Real aggregate stats from leads, bookings and payments." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total leads" value={leadCount} />
        <StatCard label="Total bookings" value={bookingCount} />
        <StatCard label="Paid revenue" value={formatInr(paidRevenue._sum.amountInr ?? 0)} />
        <StatCard label="This month" value={formatInr(monthRevenue._sum.amountInr ?? 0)} />
        <StatCard label="Average booking" value={formatInr(Math.round(averageBooking._avg.totalAmountInr ?? 0))} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ScrollTable>
          <thead><tr><Th>Booking status</Th><Th>Count</Th></tr></thead>
          <tbody className="divide-y divide-line">{bookingStatuses.map((row) => <tr key={row.status}><Td>{row.status.replaceAll("_", " ")}</Td><Td>{row._count._all}</Td></tr>)}</tbody>
        </ScrollTable>
        <ScrollTable>
          <thead><tr><Th>Lead stage</Th><Th>Count</Th></tr></thead>
          <tbody className="divide-y divide-line">{leadStages.map((row) => <tr key={row.stage}><Td>{row.stage.replaceAll("_", " ")}</Td><Td>{row._count._all}</Td></tr>)}</tbody>
        </ScrollTable>
      </div>

      <ScrollTable>
        <thead><tr><Th>Studio</Th><Th>Bookings</Th><Th>Attributed value</Th></tr></thead>
        <tbody className="divide-y divide-line">
          {topStudios.map((row) => {
            const studio = studioMap.get(row.studioId);
            return <tr key={row.studioId}><Td>{studio ? `${studio.number} · ${studio.title}` : row.studioId}</Td><Td>{row._count._all}</Td><Td><Money value={row._sum.totalAmountInr ?? 0} /></Td></tr>;
          })}
        </tbody>
      </ScrollTable>
    </div>
  );
}
