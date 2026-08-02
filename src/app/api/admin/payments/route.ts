import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { jsonData, searchParams } from "@/lib/api/route-helpers";

export async function GET(request: NextRequest) {
  const authResult = await requireApiUser(request, "payments:manage");
  if ("error" in authResult) return authResult.error;
  const status = searchParams(request).get("status");
  const payments = await prisma.payment.findMany({
    where: status ? { status: status as never } : undefined,
    include: { customer: true, booking: { include: { studio: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return jsonData(payments);
}
