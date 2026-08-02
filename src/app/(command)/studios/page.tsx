import { PageHeader } from "@/components/ui/primitives";
import { EmptyOrTable, LinkCell, Money, ScrollTable, StatusBadge, Td, Th } from "@/components/command/page-kit";
import { StudioForm } from "@/components/command/studio-form";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function StudiosPage() {
  await requirePermission("studios:manage");
  const studios = await prisma.studio.findMany({ orderBy: [{ sortOrder: "asc" }, { number: "asc" }] });
  return (
    <div className="space-y-6">
      <PageHeader title="Studios" description="Manage live inventory, pricing hints, readiness and feature flags." />
      <StudioForm />
      <EmptyOrTable count={studios.length} title="No studios configured" description="Create the first studio to start accepting holds and bookings.">
        <ScrollTable>
          <thead>
            <tr>
              <Th>Studio</Th>
              <Th>Category</Th>
              <Th>Guests</Th>
              <Th>Hourly</Th>
              <Th>Weekday</Th>
              <Th>Cleaning</Th>
              <Th>Availability</Th>
              <Th>Active</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {studios.map((studio) => (
              <tr key={studio.id}>
                <Td><LinkCell href={`/studios/${studio.id}`}>{studio.number} · {studio.title}</LinkCell></Td>
                <Td>{studio.category.replaceAll("_", " ")}</Td>
                <Td>{studio.maxGuests}</Td>
                <Td><Money value={studio.hourlyPriceInr} /></Td>
                <Td><Money value={studio.weekdayPriceInr} /></Td>
                <Td><StatusBadge value={studio.cleaningStatus} /></Td>
                <Td><StatusBadge value={studio.availabilityStatus} /></Td>
                <Td><StatusBadge value={studio.active ? "ACTIVE" : "INACTIVE"} /></Td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      </EmptyOrTable>
    </div>
  );
}
