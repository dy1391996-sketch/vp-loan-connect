import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { StaffRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { COOKIE_NAME } from "@/lib/constants";
import { sha256 } from "@/lib/utils";
import { verifyAccessToken } from "@/lib/security/tokens";
import { can, type Permission } from "@/lib/auth/permissions";

export async function getSession() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const payload = await verifyAccessToken(token, "admin_session");
    if (typeof payload.sessionId !== "string") return null;
    const session = await prisma.session.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: true },
    });
    if (!session || session.id !== payload.sessionId || session.revokedAt || session.expiresAt < new Date() || !session.user.active) {
      return null;
    }
    return { token, session, user: session.user };
  } catch {
    return null;
  }
}

export async function requireUser(roles?: StaffRole[]) {
  const auth = await getSession();
  if (!auth) redirect("/login");
  if (roles && !roles.includes(auth.user.role)) redirect("/?error=forbidden");
  return auth;
}

export async function requirePermission(permission: Permission) {
  const auth = await requireUser();
  if (!can(auth.user.role, permission)) redirect("/?error=forbidden");
  return auth;
}

export async function writeAudit(input: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ipHash?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      before: input.before ? (input.before as object) : undefined,
      after: input.after ? (input.after as object) : undefined,
      ipHash: input.ipHash ?? null,
    },
  });
}
