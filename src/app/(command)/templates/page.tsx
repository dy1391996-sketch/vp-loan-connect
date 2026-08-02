import { PageHeader } from "@/components/ui/primitives";
import { EmptyOrTable, ScrollTable, StatusBadge, Td, Th } from "@/components/command/page-kit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function TemplatesPage() {
  await requirePermission("bookings:manage");
  const templates = await prisma.messageTemplate.findMany({ orderBy: [{ active: "desc" }, { key: "asc" }] });
  return (
    <div className="space-y-6">
      <PageHeader title="Message templates" description="WhatsApp and internal message templates stored in MessageTemplate." />
      <EmptyOrTable count={templates.length} title="No templates configured" description="Add MessageTemplate rows for payment reminders, confirmations, pre-arrival and review flows.">
        <ScrollTable>
          <thead><tr><Th>Key</Th><Th>Name</Th><Th>Channel</Th><Th>Language</Th><Th>Approved</Th><Th>Active</Th><Th>Body</Th></tr></thead>
          <tbody className="divide-y divide-line">
            {templates.map((template) => (
              <tr key={template.id}>
                <Td className="font-medium">{template.key}</Td>
                <Td>{template.name}</Td>
                <Td>{template.channel}</Td>
                <Td>{template.language}</Td>
                <Td><StatusBadge value={template.approved ? "APPROVED" : "PENDING"} /></Td>
                <Td><StatusBadge value={template.active ? "ACTIVE" : "INACTIVE"} /></Td>
                <Td className="max-w-xl whitespace-normal">{template.body}</Td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      </EmptyOrTable>
    </div>
  );
}
