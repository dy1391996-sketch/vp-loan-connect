import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Card, Badge } from "@/components/ui/primitives";
import { StatusBadge, Money, DateTime } from "@/components/command/page-kit";
import { InboxThreadActions } from "@/components/command/inbox-thread-actions";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { suggestStaffReply } from "@/lib/ai/orchestrator";

export default async function InboxThreadPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("inbox:manage");
  const { id } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      customer: {
        include: {
          leads: { orderBy: { updatedAt: "desc" }, take: 1 },
          bookings: { include: { studio: true, payments: true }, orderBy: { createdAt: "desc" }, take: 3 },
        },
      },
      messages: { orderBy: { createdAt: "asc" }, take: 200 },
      notes: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!conversation) notFound();

  await prisma.conversation.update({ where: { id }, data: { unreadCount: 0 } });
  const suggestion = await suggestStaffReply(id).catch(() => "");
  const lead = conversation.customer.leads[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={conversation.customer.name ?? conversation.customer.phone ?? "Conversation"}
        description={`${conversation.channel.replaceAll("_", " ")} · ${conversation.customer.preferredLanguage}`}
        actions={
          <Link href="/inbox" className="text-sm text-copper-600 hover:underline">
            ← Back to inbox
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StatusBadge value={conversation.status} />
            {conversation.urgent ? <Badge tone="danger">Urgent</Badge> : null}
            {conversation.aiPaused ? <Badge tone="warn">AI paused</Badge> : <Badge tone="success">AI active</Badge>}
          </div>
          {conversation.summary ? (
            <p className="mb-4 rounded-xl bg-sand-100 p-3 text-sm text-ink-800">
              {conversation.summary.split("\n@@memory:")[0]}
            </p>
          ) : null}
          {conversation.pendingAction ? (
            <p className="mb-4 text-sm font-medium text-copper-600">Pending: {conversation.pendingAction}</p>
          ) : null}
          <InboxThreadActions
            conversationId={conversation.id}
            aiPaused={conversation.aiPaused}
            suggestion={suggestion}
            messages={conversation.messages.map((m) => ({
              id: m.id,
              direction: m.direction,
              body: m.body,
              aiGenerated: m.aiGenerated,
              createdAt: m.createdAt,
              intent: m.intent,
            }))}
          />
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/60">Customer</p>
            <p className="mt-2 font-medium">{conversation.customer.name ?? "—"}</p>
            <p className="text-sm text-ink-700/80">{conversation.customer.phone ?? "No phone"}</p>
            <p className="mt-2 text-xs text-ink-700/60">Returning: {conversation.customer.returningCustomer ? "Yes" : "No"}</p>
            <p className="text-xs text-ink-700/60">Opted out: {conversation.customer.optedOut ? "Yes" : "No"}</p>
            {conversation.customer.memorySummary ? (
              <p className="mt-3 text-sm text-ink-800">{conversation.customer.memorySummary}</p>
            ) : null}
          </Card>

          {lead ? (
            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/60">Lead</p>
              <div className="mt-2"><StatusBadge value={lead.stage} /></div>
              <p className="mt-2 text-sm">{lead.temperature} · {lead.bookingProbability}%</p>
              <p className="text-sm text-ink-700/80">{lead.aiDetectedIntent ?? "—"}</p>
              <Link href={`/leads/${lead.id}`} className="mt-2 inline-block text-sm text-copper-600 hover:underline">
                Open lead
              </Link>
            </Card>
          ) : null}

          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/60">Bookings</p>
            <div className="mt-2 space-y-3">
              {conversation.customer.bookings.length === 0 ? (
                <p className="text-sm text-ink-700/70">No bookings yet</p>
              ) : (
                conversation.customer.bookings.map((b) => (
                  <div key={b.id} className="text-sm">
                    <Link href={`/bookings/${b.id}`} className="font-medium text-copper-600 hover:underline">
                      {b.reference}
                    </Link>
                    <p>{b.studio.title}</p>
                    <p>
                      <StatusBadge value={b.status} /> · <Money value={b.totalAmountInr} />
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/60">Internal notes</p>
            <div className="mt-2 space-y-2">
              {conversation.notes.length === 0 ? (
                <p className="text-sm text-ink-700/70">No notes</p>
              ) : (
                conversation.notes.map((n) => (
                  <div key={n.id} className="rounded-xl bg-sand-100 p-2 text-sm">
                    <p>{n.body}</p>
                    <p className="mt-1 text-[10px] text-ink-700/60">
                      {n.author.name} · <DateTime value={n.createdAt} />
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
