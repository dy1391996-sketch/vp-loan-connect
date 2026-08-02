import { PageHeader } from "@/components/ui/primitives";
import { DateTime, EmptyOrTable, JsonBlock, ScrollTable, Td, Th } from "@/components/command/page-kit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function AuditPage() {
  await requirePermission("audit:view");
  const logs = await prisma.auditLog.findMany({
    include: { actor: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Audit logs" description="Recent mutation audit trail written by admin routes and domain actions." />
      <EmptyOrTable count={logs.length} title="No audit logs" description="Mutation routes write AuditLog rows as records are created or updated.">
        <ScrollTable>
          <thead><tr><Th>Time</Th><Th>Actor</Th><Th>Action</Th><Th>Entity</Th><Th>Before</Th><Th>After</Th></tr></thead>
          <tbody className="divide-y divide-line">
            {logs.map((log) => (
              <tr key={log.id}>
                <Td><DateTime value={log.createdAt} /></Td>
                <Td>{log.actor?.name ?? log.actor?.email ?? "System"}</Td>
                <Td>{log.action}</Td>
                <Td>{log.entityType}{log.entityId ? ` · ${log.entityId}` : ""}</Td>
                <Td className="min-w-80"><JsonBlock value={log.before ?? {}} /></Td>
                <Td className="min-w-80"><JsonBlock value={log.after ?? {}} /></Td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      </EmptyOrTable>
    </div>
  );
}
