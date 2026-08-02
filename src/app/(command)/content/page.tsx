import { PageHeader, StatCard } from "@/components/ui/primitives";
import { DateTime, EmptyOrTable, ScrollTable, StatusBadge, Td, Th } from "@/components/command/page-kit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function ContentPage() {
  await requirePermission("content:manage");
  const [drafts, total, pending, published] = await Promise.all([
    prisma.contentDraft.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.contentDraft.count(),
    prisma.contentDraft.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.contentDraft.count({ where: { status: "PUBLISHED" } }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Content studio" description="Phase 4 content drafts with real draft counts and approval status." />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Drafts" value={total} />
        <StatCard label="Pending approval" value={pending} />
        <StatCard label="Published" value={published} />
      </div>
      <EmptyOrTable count={drafts.length} title="No content drafts" description="AI-generated reels, captions and campaigns will appear here in Phase 4 once created.">
        <ScrollTable>
          <thead><tr><Th>Category</Th><Th>Status</Th><Th>Mode</Th><Th>Hook</Th><Th>Scheduled</Th><Th>Created</Th></tr></thead>
          <tbody className="divide-y divide-line">
            {drafts.map((draft) => (
              <tr key={draft.id}>
                <Td>{draft.category.replaceAll("_", " ")}</Td>
                <Td><StatusBadge value={draft.status} /></Td>
                <Td>{draft.mode.replaceAll("_", " ")}</Td>
                <Td className="max-w-md whitespace-normal">{draft.hook ?? draft.caption ?? "-"}</Td>
                <Td><DateTime value={draft.scheduledAt} /></Td>
                <Td><DateTime value={draft.createdAt} /></Td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      </EmptyOrTable>
    </div>
  );
}
