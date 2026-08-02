import { PageHeader, StatCard } from "@/components/ui/primitives";
import { DateTime, EmptyOrTable, LinkCell, Money, ScrollTable, StatusBadge, Td, Th } from "@/components/command/page-kit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatInr } from "@/lib/utils";

export default async function DashboardPage() {
  await requirePermission("dashboard:view");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [enquiriesToday, confirmedBookings, revenue, availableStudios, hotLeads, pendingPayments, recentBookings] = await Promise.all([
    prisma.lead.count({ where: { firstContactAt: { gte: today, lt: tomorrow } } }),
    prisma.booking.count({ where: { status: { in: ["CONFIRMED", "CHECKED_IN"] } } }),
    prisma.payment.aggregate({ where: { status: "PAID" }, _sum: { amountInr: true } }),
    prisma.studio.count({ where: { active: true, availabilityStatus: { in: ["AVAILABLE", "READY"] } } }),
    prisma.lead.count({ where: { temperature: "HOT", stage: { notIn: ["CONFIRMED", "LOST", "SPAM"] } } }),
    prisma.payment.count({ where: { status: { in: ["CREATED", "PENDING"] } } }),
    prisma.booking.findMany({
      include: { customer: true, studio: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="AI Command Center" description="Live operating view across enquiries, bookings, inventory, payments and follow-up risk." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Enquiries today" value={enquiriesToday} hint="New first contacts since midnight" />
        <StatCard label="Confirmed bookings" value={confirmedBookings} hint="Confirmed or checked-in" />
        <StatCard label="Revenue" value={formatInr(revenue._sum.amountInr ?? 0)} hint="Paid payments" />
        <StatCard label="Available studios" value={availableStudios} hint="Active and ready/available" />
        <StatCard label="Hot leads" value={hotLeads} hint="Needs fast sales response" />
        <StatCard label="Pending payments" value={pendingPayments} hint="Created or pending" />
      </div>

      <section>
        <h2 className="mb-3 font-display text-xl text-ink-950">Recent bookings</h2>
        <EmptyOrTable count={recentBookings.length} title="No bookings yet" description="New booking drafts and confirmations will appear here as soon as they are created.">
          <ScrollTable>
            <thead>
              <tr>
                <Th>Reference</Th>
                <Th>Customer</Th>
                <Th>Studio</Th>
                <Th>Check-in</Th>
                <Th>Total</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {recentBookings.map((booking) => (
                <tr key={booking.id}>
                  <Td><LinkCell href={`/bookings/${booking.id}`}>{booking.reference}</LinkCell></Td>
                  <Td>{booking.customer.name ?? booking.customer.phone ?? "Guest"}</Td>
                  <Td>{booking.studio.number}</Td>
                  <Td><DateTime value={booking.checkInAt} /></Td>
                  <Td><Money value={booking.totalAmountInr} /></Td>
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
