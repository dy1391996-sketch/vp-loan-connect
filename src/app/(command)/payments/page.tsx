import { PageHeader } from "@/components/ui/primitives";
import { DateTime, EmptyOrTable, LinkCell, Money, ScrollTable, StatusBadge, Td, Th } from "@/components/command/page-kit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function PaymentsPage() {
  await requirePermission("payments:manage");
  const payments = await prisma.payment.findMany({
    include: { customer: true, booking: { include: { studio: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Token, balance and full payments with provider IDs and paid timestamps." />
      <EmptyOrTable count={payments.length} title="No payments yet" description="Payment rows are created when booking payment links are generated or webhooks are received.">
        <ScrollTable>
          <thead>
            <tr>
              <Th>Customer</Th>
              <Th>Booking</Th>
              <Th>Kind</Th>
              <Th>Status</Th>
              <Th>Amount</Th>
              <Th>Provider</Th>
              <Th>Paid at</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {payments.map((payment) => (
              <tr key={payment.id}>
                <Td>{payment.customer.name ?? payment.customer.phone ?? "Guest"}</Td>
                <Td>{payment.booking ? <LinkCell href={`/bookings/${payment.booking.id}`}>{payment.booking.reference}</LinkCell> : "-"}</Td>
                <Td>{payment.kind}</Td>
                <Td><StatusBadge value={payment.status} /></Td>
                <Td><Money value={payment.amountInr} /></Td>
                <Td>{payment.provider}</Td>
                <Td><DateTime value={payment.paidAt} /></Td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      </EmptyOrTable>
    </div>
  );
}
