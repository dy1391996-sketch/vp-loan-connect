import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/primitives";
import { PaymentLinkButton } from "@/components/command/payment-link-button";
import { DateTime, EmptyOrTable, KeyValueGrid, Money, ScrollTable, StatusBadge, Td, Th } from "@/components/command/page-kit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("bookings:manage");
  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      customer: true,
      studio: true,
      lead: true,
      payments: { orderBy: { createdAt: "desc" } },
      guests: true,
      cleaningTasks: true,
      tickets: true,
    },
  });
  if (!booking) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={`Booking ${booking.reference}`} description="Booking status, customer, payment history and operational tasks." actions={<PaymentLinkButton bookingId={booking.id} />} />
      <KeyValueGrid
        items={[
          { label: "Status", value: <StatusBadge value={booking.status} /> },
          { label: "Customer", value: booking.customer.name ?? booking.customer.phone ?? "Guest" },
          { label: "Studio", value: `${booking.studio.number} · ${booking.studio.title}` },
          { label: "Check-in", value: <DateTime value={booking.checkInAt} /> },
          { label: "Check-out", value: <DateTime value={booking.checkOutAt} /> },
          { label: "Guests", value: booking.guestCount },
          { label: "Base", value: <Money value={booking.baseAmountInr} /> },
          { label: "Token", value: <Money value={booking.tokenAmountInr} /> },
          { label: "Total", value: <Money value={booking.totalAmountInr} /> },
        ]}
      />

      <section>
        <h2 className="mb-3 font-display text-xl text-ink-950">Payments</h2>
        <EmptyOrTable count={booking.payments.length} title="No payments yet" description="Generate a token payment link to create the first payment row.">
          <ScrollTable>
            <thead><tr><Th>Kind</Th><Th>Status</Th><Th>Amount</Th><Th>Provider payment</Th><Th>Created</Th></tr></thead>
            <tbody className="divide-y divide-line">
              {booking.payments.map((payment) => (
                <tr key={payment.id}>
                  <Td>{payment.kind}</Td>
                  <Td><StatusBadge value={payment.status} /></Td>
                  <Td><Money value={payment.amountInr} /></Td>
                  <Td>{payment.providerPaymentId ?? payment.providerOrderId ?? "-"}</Td>
                  <Td><DateTime value={payment.createdAt} /></Td>
                </tr>
              ))}
            </tbody>
          </ScrollTable>
        </EmptyOrTable>
      </section>
    </div>
  );
}
