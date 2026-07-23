import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AdminRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sha256 } from "@/lib/utils";
import { verifyAccessToken } from "@/lib/security/tokens";

export async function getAdminSession() {
  const token = (await cookies()).get("vplc_admin")?.value;
  if (!token) return null;
  try {
    const payload = await verifyAccessToken(token, "admin_session");
    if (typeof payload.sessionId !== "string") return null;
    const session = await prisma.adminSession.findUnique({ where: { tokenHash: sha256(token) }, include: { admin: true } });
    if (!session || session.id !== payload.sessionId || session.revokedAt || session.expiresAt < new Date() || !session.admin.active) return null;
    return { token, session, admin: session.admin };
  } catch { return null; }
}

export async function requireAdmin(roles?: AdminRole[]) {
  const auth = await getAdminSession();
  if (!auth) redirect("/admin/login");
  if (roles && !roles.includes(auth.admin.role)) redirect("/admin?error=forbidden");
  return auth;
}
