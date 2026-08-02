import { PageHeader } from "@/components/ui/primitives";
import { DateTime, EmptyOrTable, ScrollTable, StatusBadge, Td, Th } from "@/components/command/page-kit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function InboxPage() {
  await requirePermission("inbox:manage");
  const conversations = await prisma.conversation.findMany({
    include: { customer: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: [{ urgent: "desc" }, { lastMessageAt: "desc" }],
    take: 100,
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Unified inbox" description="WhatsApp and Instagram conversations will land here once Phase 2 messaging is connected." />
      <EmptyOrTable count={conversations.length} title="Inbox is empty" description="Phase 2 will connect Meta WhatsApp/Instagram threads. Existing Conversation rows will still appear here as soon as they exist.">
        <ScrollTable>
          <thead><tr><Th>Customer</Th><Th>Channel</Th><Th>Status</Th><Th>Unread</Th><Th>Last message</Th><Th>Summary</Th></tr></thead>
          <tbody className="divide-y divide-line">
            {conversations.map((conversation) => (
              <tr key={conversation.id}>
                <Td>{conversation.customer.name ?? conversation.customer.phone ?? "Guest"}</Td>
                <Td>{conversation.channel.replaceAll("_", " ")}</Td>
                <Td><StatusBadge value={conversation.status} /></Td>
                <Td>{conversation.unreadCount}</Td>
                <Td><DateTime value={conversation.lastMessageAt} /></Td>
                <Td className="max-w-md whitespace-normal">{conversation.summary ?? conversation.messages[0]?.body ?? "-"}</Td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      </EmptyOrTable>
    </div>
  );
}
