import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { jsonData, searchParams } from "@/lib/api/route-helpers";

export async function GET(request: NextRequest) {
  const authResult = await requireApiUser(request, "customers:view");
  if ("error" in authResult) return authResult.error;
  const q = searchParams(request).get("q");
  const customers = await prisma.customer.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: { _count: { select: { leads: true, bookings: true, payments: true } }, preferredStudio: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return jsonData(customers);
}
