import { PageHeader, StatCard } from "@/components/ui/primitives";
import { DateTime, EmptyOrTable, ScrollTable, StatusBadge, Td, Th } from "@/components/command/page-kit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function MaintenancePage() {
  await requirePermission("cleaning:manage");
  const [tasks, blocking, open] = await Promise.all([
    prisma.maintenanceTask.findMany({ include: { studio: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.maintenanceTask.count({ where: { blocksStudio: true, status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] } } }),
    prisma.maintenanceTask.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] } } }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Maintenance" description="Studio-blocking and non-blocking maintenance issues." />
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Open issues" value={open} />
        <StatCard label="Blocking studios" value={blocking} />
      </div>
      <EmptyOrTable count={tasks.length} title="No maintenance issues" description="MaintenanceTask rows will appear here when staff or AI raise an issue.">
        <ScrollTable>
          <thead><tr><Th>Studio</Th><Th>Title</Th><Th>Status</Th><Th>Blocks</Th><Th>Resolved</Th><Th>Created</Th></tr></thead>
          <tbody className="divide-y divide-line">
            {tasks.map((task) => (
              <tr key={task.id}>
                <Td>{task.studio.number}</Td>
                <Td className="max-w-md whitespace-normal">{task.title}</Td>
                <Td><StatusBadge value={task.status} /></Td>
                <Td>{task.blocksStudio ? "Yes" : "No"}</Td>
                <Td><DateTime value={task.resolvedAt} /></Td>
                <Td><DateTime value={task.createdAt} /></Td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      </EmptyOrTable>
    </div>
  );
}
