import { PageHeader } from "@/components/ui/primitives";
import { TeamForm } from "@/components/command/team-form";
import { DateTime, EmptyOrTable, ScrollTable, StatusBadge, Td, Th } from "@/components/command/page-kit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function TeamPage() {
  await requirePermission("team:manage");
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, phone: true, active: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Team" description="Owner-managed staff accounts and roles." />
      <TeamForm />
      <EmptyOrTable count={users.length} title="No team members" description="Create an owner or staff member to access the command center.">
        <ScrollTable>
          <thead><tr><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Phone</Th><Th>Status</Th><Th>Created</Th></tr></thead>
          <tbody className="divide-y divide-line">
            {users.map((user) => (
              <tr key={user.id}>
                <Td className="font-medium">{user.name}</Td>
                <Td>{user.email}</Td>
                <Td>{user.role.replaceAll("_", " ")}</Td>
                <Td>{user.phone ?? "-"}</Td>
                <Td><StatusBadge value={user.active ? "ACTIVE" : "INACTIVE"} /></Td>
                <Td><DateTime value={user.createdAt} /></Td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
      </EmptyOrTable>
    </div>
  );
}
