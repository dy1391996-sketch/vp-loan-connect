import { PageHeader, StatCard } from "@/components/ui/primitives";
import { DateTime, EmptyOrTable, ScrollTable, StatusBadge, Td, Th } from "@/components/command/page-kit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function MediaPage() {
  await requirePermission("studios:manage");
  const [media, approved, needsEdit] = await Promise.all([
    prisma.studioMedia.findMany({ include: { studio: true }, orderBy: [{ createdAt: "desc" }], take: 100 }),
    prisma.studioMedia.count({ where: { approved: true } }),
    prisma.studioMedia.count({ where: { needsEdit: true } }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Media library" description="StudioMedia assets for Phase 4 social content and sales sharing." />
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Approved media" value={approved} />
        <StatCard label="Needs edit" value={needsEdit} />
      </div>
      <EmptyOrTable count={media.length} title="No media uploaded" description="Approved StudioMedia rows will power future reels, stories and customer photo sharing.">
        <ScrollTable>
          <thead><tr><Th>Studio</Th><Th>Type</Th><Th>Approved</Th><Th>Cover</Th><Th>Tags</Th><Th>Created</Th></tr></thead>
          <tbody className="divide-y divide-line">
            {media.map((item) => (
              <tr key={item.id}>
                <Td>{item.studio.number} · {item.studio.title}</Td>
                <Td>{item.mediaType}</Td>
                <Td><StatusBadge value={item.approved ? "APPROVED" : "PENDING"} /></Td>
                <Td>{item.isCover ? "Yes" : "No"}</Td>
                <Td>{item.tags.join(", ") || "-"}</Td>
                <Td><DateTime value={item.createdAt} /></Td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      </EmptyOrTable>
    </div>
  );
}
