import { PageHeader } from "@/components/ui/primitives";
import { SettingForm } from "@/components/command/settings-form";
import { DateTime, EmptyOrTable, JsonBlock, ScrollTable, Td, Th } from "@/components/command/page-kit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function SettingsPage() {
  await requirePermission("settings:manage");
  const settings = await prisma.businessSetting.findMany({ orderBy: { key: "asc" } });
  return (
    <div className="space-y-6">
      <PageHeader title="Business settings" description="Key/value BusinessSetting records used by automations, prompts and operating policy." />
      <SettingForm />
      <EmptyOrTable count={settings.length} title="No business settings" description="Use the form above to create JSON-backed business settings.">
        <ScrollTable>
          <thead><tr><Th>Key</Th><Th>Value</Th><Th>Updated</Th></tr></thead>
          <tbody className="divide-y divide-line">
            {settings.map((setting) => (
              <tr key={setting.id}>
                <Td className="font-medium">{setting.key}</Td>
                <Td className="min-w-96"><JsonBlock value={setting.value} /></Td>
                <Td><DateTime value={setting.updatedAt} /></Td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      </EmptyOrTable>
    </div>
  );
}
