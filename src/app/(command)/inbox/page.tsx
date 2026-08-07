import Link from "next/link";
import { PageHeader, Badge, Card } from "@/components/ui/primitives";
import { DateTime, StatusBadge } from "@/components/command/page-kit";
import { SimulateWhatsAppForm } from "@/components/command/simulate-whatsapp-form";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getChannelAttributionMetrics } from "@/lib/domain/attribution-metrics";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; handover?: string; urgent?: string; channel?: string }>;
}) {
  await requirePermission("inbox:manage");
  const params = await searchParams;

  const conversations = await prisma.conversation.findMany({
    where: {
      ...(params.handover === "1" ? { status: "HUMAN_HANDOVER" } : {}),
      ...(params.urgent === "1" ? { urgent: true } : {}),
      ...(params.channel ? { channel: params.channel as never } : {}),
      ...(params.q
        ? {
            OR: [
              { customer: { name: { contains: params.q, mode: "insensitive" } } },
              { customer: { phone: { contains: params.q } } },
              { summary: { contains: params.q, mode: "insensitive" } },
              { attributionPath: { contains: params.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      customer: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: [{ urgent: "desc" }, { lastMessageAt: "desc" }],
    take: 100,
  });

  const handoverCount = await prisma.conversation.count({ where: { status: "HUMAN_HANDOVER" } });
  const unread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  const metrics = await getChannelAttributionMetrics();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Unified inbox"
        description="WhatsApp, Instagram DMs and Instagram comments with AI, handover and cross-channel attribution."
        actions={
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge tone="warn">{handoverCount} handover</Badge>
            <Badge tone="info">{unread} unread in view</Badge>
            <Badge tone="neutral">{metrics.handoffsConsumed} WA handoffs</Badge>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 text-sm">
        <FilterLink href="/inbox" active={!params.handover && !params.urgent && !params.channel}>
          All
        </FilterLink>
        <FilterLink href="/inbox?channel=WHATSAPP" active={params.channel === "WHATSAPP"}>
          WhatsApp
        </FilterLink>
        <FilterLink href="/inbox?channel=INSTAGRAM_DM" active={params.channel === "INSTAGRAM_DM"}>
          Instagram DM
        </FilterLink>
        <FilterLink href="/inbox?channel=INSTAGRAM_COMMENT" active={params.channel === "INSTAGRAM_COMMENT"}>
          IG Comments
        </FilterLink>
        <FilterLink href="/inbox?handover=1" active={params.handover === "1"}>
          Human queue
        </FilterLink>
        <FilterLink href="/inbox?urgent=1" active={params.urgent === "1"}>
          Urgent
        </FilterLink>
      </div>

      <SimulateWhatsAppForm />

      <div className="grid gap-3">
        {conversations.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="font-display text-lg">No conversations yet</p>
            <p className="mt-2 text-sm text-ink-700/70">Use the sandbox simulator above, or connect Meta webhooks.</p>
          </Card>
        ) : (
          conversations.map((c) => (
            <Link key={c.id} href={`/inbox/${c.id}`} className="block">
              <Card className={`p-4 transition hover:border-copper-500/50 ${c.urgent ? "border-rose-500/40" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink-950">{c.customer.name ?? c.customer.phone ?? "Guest"}</p>
                      <ChannelPill channel={c.channel} />
                    </div>
                    <p className="mt-1 text-sm text-ink-700/80 line-clamp-2">{c.messages[0]?.body ?? c.summary ?? "No messages"}</p>
                    {c.attributionPath ? <p className="mt-1 text-xs text-copper-600">Source: {c.attributionPath}</p> : null}
                  </div>
                  <div className="text-right text-xs text-ink-700/70">
                    <StatusBadge value={c.status} />
                    <p className="mt-2">
                      <DateTime value={c.lastMessageAt} />
                    </p>
                    {c.unreadCount > 0 ? <p className="mt-1 font-semibold text-copper-600">{c.unreadCount} unread</p> : null}
                    {c.aiPaused ? <p className="mt-1 text-rose-500">AI paused</p> : null}
                  </div>
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function FilterLink({ href, active, children }: { href: string; active?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 ${active ? "bg-ink-900 text-sand-50" : "bg-white text-ink-800 border border-line"}`}
    >
      {children}
    </Link>
  );
}

function ChannelPill({ channel }: { channel: string }) {
  const label =
    channel === "WHATSAPP" ? "WhatsApp" : channel === "INSTAGRAM_DM" ? "IG DM" : channel === "INSTAGRAM_COMMENT" ? "IG Comment" : channel;
  return <span className="rounded-full bg-sand-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-700">{label}</span>;
}
