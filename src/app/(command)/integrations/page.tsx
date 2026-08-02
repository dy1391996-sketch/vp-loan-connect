import { PageHeader } from "@/components/ui/primitives";
import { DateTime, EmptyOrTable, JsonBlock, ScrollTable, StatusBadge, Td, Th } from "@/components/command/page-kit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function IntegrationsPage() {
  await requirePermission("integrations:manage");
  const integrations = await prisma.integration.findMany({ orderBy: { provider: "asc" } });
  return (
    <div className="space-y-6">
      <PageHeader title="Integrations" description="Provider status and non-secret metadata. Credentials are never displayed." />
      <EmptyOrTable count={integrations.length} title="No integrations configured" description="Integration rows for WhatsApp, Instagram, Razorpay, OpenAI and media providers will appear here.">
        <ScrollTable>
          <thead><tr><Th>Provider</Th><Th>Enabled</Th><Th>Mode</Th><Th>Last sync</Th><Th>Metadata</Th></tr></thead>
          <tbody className="divide-y divide-line">
            {integrations.map((integration) => (
              <tr key={integration.id}>
                <Td className="font-medium">{integration.provider}</Td>
                <Td><StatusBadge value={integration.enabled ? "ENABLED" : "DISABLED"} /></Td>
                <Td><StatusBadge value={integration.sandboxMode ? "SANDBOX" : "LIVE"} /></Td>
                <Td><DateTime value={integration.lastSyncedAt} /></Td>
                <Td className="min-w-80"><JsonBlock value={integration.metadata ?? {}} /></Td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      </EmptyOrTable>
    </div>
  );
}
