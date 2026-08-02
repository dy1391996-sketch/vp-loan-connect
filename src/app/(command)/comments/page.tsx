import { PageHeader, StatCard } from "@/components/ui/primitives";
import { DateTime, EmptyOrTable, ScrollTable, StatusBadge, Td, Th } from "@/components/command/page-kit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function CommentsPage() {
  await requirePermission("content:manage");
  const [comments, humanRequired, bookingEnquiries] = await Promise.all([
    prisma.socialComment.findMany({ include: { post: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.socialComment.count({ where: { requiresHuman: true } }),
    prisma.socialComment.count({ where: { category: "BOOKING_ENQUIRY" } }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Comments" description="Phase 4 social comments with categorization and human-review flags." />
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Needs human" value={humanRequired} />
        <StatCard label="Booking enquiries" value={bookingEnquiries} />
      </div>
      <EmptyOrTable count={comments.length} title="No social comments" description="Instagram comments captured in Phase 4 will appear here with categories and replies.">
        <ScrollTable>
          <thead><tr><Th>Author</Th><Th>Category</Th><Th>Body</Th><Th>Human</Th><Th>Replied</Th><Th>Created</Th></tr></thead>
          <tbody className="divide-y divide-line">
            {comments.map((comment) => (
              <tr key={comment.id}>
                <Td>{comment.authorUsername ?? "-"}</Td>
                <Td><StatusBadge value={comment.category} /></Td>
                <Td className="max-w-lg whitespace-normal">{comment.body}</Td>
                <Td><StatusBadge value={comment.requiresHuman ? "REQUIRED" : "NO"} /></Td>
                <Td><DateTime value={comment.repliedAt} /></Td>
                <Td><DateTime value={comment.createdAt} /></Td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      </EmptyOrTable>
    </div>
  );
}
