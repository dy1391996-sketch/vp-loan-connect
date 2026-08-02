import { PageHeader, StatCard } from "@/components/ui/primitives";
import { DateTime, EmptyOrTable, ScrollTable, StatusBadge, Td, Th } from "@/components/command/page-kit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function ReviewsPage() {
  await requirePermission("customers:view");
  const [reviews, pendingRequests, completedRequests] = await Promise.all([
    prisma.customerReview.findMany({ include: { customer: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.reviewRequest.count({ where: { status: "PENDING" } }),
    prisma.reviewRequest.count({ where: { status: "COMPLETED" } }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Reviews" description="Customer reviews and review-request funnel." />
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Pending requests" value={pendingRequests} />
        <StatCard label="Completed requests" value={completedRequests} />
      </div>
      <EmptyOrTable count={reviews.length} title="No reviews captured" description="CustomerReview rows from Google or manual entry will appear here.">
        <ScrollTable>
          <thead><tr><Th>Customer</Th><Th>Source</Th><Th>Rating</Th><Th>Review</Th><Th>Created</Th><Th>URL</Th></tr></thead>
          <tbody className="divide-y divide-line">
            {reviews.map((review) => (
              <tr key={review.id}>
                <Td>{review.customer.name ?? review.customer.phone ?? "Guest"}</Td>
                <Td>{review.source}</Td>
                <Td><StatusBadge value={review.rating ? `${review.rating}_STAR` : "UNRATED"} /></Td>
                <Td className="max-w-lg whitespace-normal">{review.body ?? "-"}</Td>
                <Td><DateTime value={review.createdAt} /></Td>
                <Td>{review.publicUrl ? <a className="text-copper-600" href={review.publicUrl} target="_blank" rel="noreferrer">Open</a> : "-"}</Td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      </EmptyOrTable>
    </div>
  );
}
