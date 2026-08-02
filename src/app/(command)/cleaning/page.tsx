import { PageHeader, StatCard } from "@/components/ui/primitives";
import { DateTime, EmptyOrTable, ScrollTable, StatusBadge, Td, Th } from "@/components/command/page-kit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function CleaningPage() {
  await requirePermission("cleaning:manage");
  const [tasks, pending, ready] = await Promise.all([
    prisma.cleaningTask.findMany({ include: { studio: true, booking: true, assignee: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.cleaningTask.count({ where: { status: { in: ["PENDING", "ASSIGNED", "IN_PROGRESS", "AWAITING_APPROVAL"] } } }),
    prisma.studio.count({ where: { cleaningStatus: { in: ["READY", "CLEAN"] } } }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Cleaning" description="Cleaning tasks, proof state and studio readiness." />
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Open cleaning tasks" value={pending} />
        <StatCard label="Ready studios" value={ready} />
      </div>
      <EmptyOrTable count={tasks.length} title="No cleaning tasks" description="Checkout, daily and deep-clean tasks will appear here when created.">
        <ScrollTable>
          <thead><tr><Th>Studio</Th><Th>Type</Th><Th>Status</Th><Th>Assignee</Th><Th>Checkout</Th><Th>Ready</Th></tr></thead>
          <tbody className="divide-y divide-line">
            {tasks.map((task) => (
              <tr key={task.id}>
                <Td>{task.studio.number}</Td>
                <Td>{task.type}</Td>
                <Td><StatusBadge value={task.status} /></Td>
                <Td>{task.assignee?.name ?? "-"}</Td>
                <Td><DateTime value={task.checkoutTime} /></Td>
                <Td><StatusBadge value={task.studioReady ? "READY" : "NOT_READY"} /></Td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      </EmptyOrTable>
    </div>
  );
}
