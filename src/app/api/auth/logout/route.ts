import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { COOKIE_NAME } from "@/lib/constants";
import { sha256 } from "@/lib/utils";
import { getSession, writeAudit } from "@/lib/auth/session";
import { jsonOk } from "@/lib/auth/api";
import { clientIp } from "@/lib/security/request";

export async function POST(request: NextRequest) {
  const auth = await getSession();
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.updateMany({
      where: { tokenHash: sha256(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  if (auth) {
    await writeAudit({
      actorId: auth.user.id,
      action: "auth.logout",
      entityType: "User",
      entityId: auth.user.id,
      ipHash: sha256(clientIp(request)),
    });
  }
  const response = jsonOk({ ok: true });
  response.cookies.delete(COOKIE_NAME);
  return response;
}
