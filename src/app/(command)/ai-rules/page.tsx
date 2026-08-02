import { PageHeader, Card } from "@/components/ui/primitives";
import { SettingForm } from "@/components/command/settings-form";
import { AI_TOOL_NAMES } from "@/lib/ai/tools";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { AI_SYSTEM_PROMPT } from "@/lib/constants";
import { prisma } from "@/lib/db";

export default async function AIRulesPage() {
  const { user } = await requireUser();
  const owner = can(user.role, "settings:manage");
  const note = await prisma.businessSetting.findUnique({ where: { key: "ai_rules_note" } });
  return (
    <div className="space-y-6">
      <PageHeader title="AI rules" description="System prompt and validated tool registry. Owners can edit the operational note stored in BusinessSetting." />
      <Card className="p-4">
        <h2 className="font-display text-lg text-ink-950">System prompt</h2>
        <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-ink-950 p-4 text-sm text-sand-50">{AI_SYSTEM_PROMPT}</pre>
      </Card>
      <Card className="p-4">
        <h2 className="font-display text-lg text-ink-950">Available AI tools</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {AI_TOOL_NAMES.map((tool) => (
            <code key={tool} className="rounded-lg bg-sand-100 px-3 py-2 text-xs text-ink-800">{tool}</code>
          ))}
        </div>
      </Card>
      {owner ? (
        <SettingForm initialKey="ai_rules_note" initialValue={JSON.stringify(note?.value ?? { note: "" }, null, 2)} />
      ) : (
        <Card className="p-4">
          <h2 className="font-display text-lg text-ink-950">Business note</h2>
          <pre className="mt-3 whitespace-pre-wrap text-sm text-ink-800">{JSON.stringify(note?.value ?? { note: "" }, null, 2)}</pre>
        </Card>
      )}
    </div>
  );
}
