import { PageHeader } from "@/components/ui/primitives";
import { BookingForm } from "@/components/command/booking-form";
import { DateTime, EmptyOrTable, LinkCell, Money, ScrollTable, StatusBadge, Td, Th } from "@/components/command/page-kit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function BookingsPage() {
  await requirePermission("bookings:manage");
  const [bookings, customers, studios] = await Promise.all([
    prisma.booking.findMany({ include: { customer: true, studio: true, payments: true }, orderBy: { checkInAt: "desc" }, take: 100 }),
    prisma.customer.findMany({ orderBy: { updatedAt: "desc" }, take: 100 }),
    prisma.studio.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { number: "asc" }] }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Bookings" description="Create booking drafts, see holds, pending token payments and confirmed stays." />
      <BookingForm
        customers={customers.map((customer) => ({ id: customer.id, label: customer.name ?? customer.phone ?? customer.email ?? customer.id }))}
        studios={studios.map((studio) => ({ id: studio.id, label: `${studio.number} · ${studio.title}` }))}
      />
      <EmptyOrTable count={bookings.length} title="No bookings yet" description="Use the form above to create a booking draft after confirming availability.">
        <ScrollTable>
          <thead>
            <tr>
              <Th>Reference</Th>
              <Th>Customer</Th>
              <Th>Studio</Th>
              <Th>Check-in</Th>
              <Th>Duration</Th>
              <Th>Total</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {bookings.map((booking) => (
              <tr key={booking.id}>
                <Td><LinkCell href={`/bookings/${booking.id}`}>{booking.reference}</LinkCell></Td>
                <Td>{booking.customer.name ?? booking.customer.phone ?? "Guest"}</Td>
                <Td>{booking.studio.number}</Td>
                <Td><DateTime value={booking.checkInAt} /></Td>
                <Td>{booking.durationHours}h</Td>
                <Td><Money value={booking.totalAmountInr} /></Td>
                <Td><StatusBadge value={booking.status} /></Td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      </EmptyOrTable>
    </div>
  );
}
