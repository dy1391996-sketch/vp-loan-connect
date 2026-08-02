import { PageHeader } from "@/components/ui/primitives";
import { DateTime, EmptyOrTable, ScrollTable, StatusBadge, Td, Th } from "@/components/command/page-kit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function CustomersPage() {
  await requirePermission("customers:view");
  const customers = await prisma.customer.findMany({
    include: { _count: { select: { leads: true, bookings: true, payments: true } }, preferredStudio: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description="Real customer profiles, preferences, repeat flags and engagement counts." />
      <EmptyOrTable count={customers.length} title="No customers yet" description="Customers are created from leads, bookings and channels.">
        <ScrollTable>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Phone</Th>
              <Th>Email</Th>
              <Th>Preferred studio</Th>
              <Th>Leads</Th>
              <Th>Bookings</Th>
              <Th>Repeat</Th>
              <Th>Updated</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {customers.map((customer) => (
              <tr key={customer.id}>
                <Td className="font-medium">{customer.name ?? "Guest"}</Td>
                <Td>{customer.phone ?? "-"}</Td>
                <Td>{customer.email ?? "-"}</Td>
                <Td>{customer.preferredStudio?.number ?? "-"}</Td>
                <Td>{customer._count.leads}</Td>
                <Td>{customer._count.bookings}</Td>
                <Td><StatusBadge value={customer.returningCustomer ? "RETURNING" : "NEW"} /></Td>
                <Td><DateTime value={customer.updatedAt} /></Td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      </EmptyOrTable>
    </div>
  );
}
