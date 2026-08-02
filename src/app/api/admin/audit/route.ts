import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { jsonData } from "@/lib/api/route-helpers";

export async function GET(request: NextRequest) {
  const authResult = await requireApiUser(request, "audit:view");
  if ("error" in authResult) return authResult.error;
  const logs = await prisma.auditLog.findMany({
    include: { actor: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return jsonData(logs);
}
