import { PageHeader, StatCard } from "@/components/ui/primitives";
import { DateTime, EmptyOrTable, ScrollTable, StatusBadge, Td, Th } from "@/components/command/page-kit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function CalendarPage() {
  await requirePermission("content:manage");
  const [posts, scheduled, drafts] = await Promise.all([
    prisma.socialPost.findMany({ include: { draft: true }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.socialPost.count({ where: { status: "SCHEDULED" } }),
    prisma.contentDraft.count({ where: { scheduledAt: { not: null } } }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Content calendar" description="Phase 4 publishing calendar backed by SocialPost and scheduled ContentDraft rows." />
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Scheduled posts" value={scheduled} />
        <StatCard label="Drafts with schedule" value={drafts} />
      </div>
      <EmptyOrTable count={posts.length} title="No scheduled posts" description="Approved SocialPost rows will appear here when Phase 4 scheduling starts.">
        <ScrollTable>
          <thead><tr><Th>Platform</Th><Th>Status</Th><Th>Caption</Th><Th>Published</Th><Th>Created</Th></tr></thead>
          <tbody className="divide-y divide-line">
            {posts.map((post) => (
              <tr key={post.id}>
                <Td>{post.platform}</Td>
                <Td><StatusBadge value={post.status} /></Td>
                <Td className="max-w-md whitespace-normal">{post.caption ?? post.draft?.caption ?? "-"}</Td>
                <Td><DateTime value={post.publishedAt} /></Td>
                <Td><DateTime value={post.createdAt} /></Td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      </EmptyOrTable>
    </div>
  );
}
