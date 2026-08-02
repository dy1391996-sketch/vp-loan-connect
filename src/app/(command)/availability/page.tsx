import { PageHeader } from "@/components/ui/primitives";
import { AvailabilitySearch } from "@/components/command/availability-search";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function AvailabilityPage() {
  await requirePermission("bookings:manage");
  const [activeStudios, activeHolds] = await Promise.all([
    prisma.studio.count({ where: { active: true } }),
    prisma.temporaryHold.count({ where: { status: "ACTIVE", expiresAt: { gt: new Date() } } }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Availability search" description={`${activeStudios} active studios · ${activeHolds} live temporary holds. Search uses the same real availability tool as the AI assistant.`} />
      <AvailabilitySearch />
    </div>
  );
}
