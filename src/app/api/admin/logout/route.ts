import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { assertSameOrigin } from "@/lib/security/request";

export async function POST(request: NextRequest) {
  assertSameOrigin(request);
  const auth = await getAdminSession();
  if (auth) await prisma.adminSession.update({ where: { id: auth.session.id }, data: { revokedAt: new Date() } });
  const response = NextResponse.json({ signedOut: true });
  response.cookies.delete("vplc_admin");
  return response;
}
