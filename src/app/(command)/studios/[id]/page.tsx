import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/primitives";
import { DateTime, EmptyOrTable, KeyValueGrid, LinkCell, ScrollTable, StatusBadge, Td, Th } from "@/components/command/page-kit";
import { StudioForm } from "@/components/command/studio-form";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function StudioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("studios:manage");
  const { id } = await params;
  const studio = await prisma.studio.findUnique({
    where: { id },
    include: {
      media: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }] },
      bookings: { include: { customer: true }, orderBy: { checkInAt: "desc" }, take: 10 },
      cleaningTasks: { orderBy: { createdAt: "desc" }, take: 10 },
      maintenanceTasks: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!studio) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={`${studio.number} · ${studio.title}`} description="Studio detail, edit form, recent bookings and operational status." />
      <KeyValueGrid
        items={[
          { label: "Category", value: studio.category.replaceAll("_", " ") },
          { label: "Cleaning", value: <StatusBadge value={studio.cleaningStatus} /> },
          { label: "Availability", value: <StatusBadge value={studio.availabilityStatus} /> },
          { label: "Guests", value: studio.maxGuests },
          { label: "Features", value: [studio.isPremium && "Premium", studio.hasBalcony && "Balcony", studio.hasJacuzzi && "Jacuzzi"].filter(Boolean).join(", ") || "Standard" },
          { label: "Amenities", value: studio.amenities.length ? studio.amenities.join(", ") : "None recorded" },
        ]}
      />
      <StudioForm studio={studio} />

      <section>
        <h2 className="mb-3 font-display text-xl text-ink-950">Recent bookings</h2>
        <EmptyOrTable count={studio.bookings.length} title="No bookings for this studio" description="Booking history will populate after the first draft or confirmed reservation.">
          <ScrollTable>
            <thead>
              <tr>
                <Th>Reference</Th>
                <Th>Customer</Th>
                <Th>Check-in</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {studio.bookings.map((booking) => (
                <tr key={booking.id}>
                  <Td><LinkCell href={`/bookings/${booking.id}`}>{booking.reference}</LinkCell></Td>
                  <Td>{booking.customer.name ?? booking.customer.phone ?? "Guest"}</Td>
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
