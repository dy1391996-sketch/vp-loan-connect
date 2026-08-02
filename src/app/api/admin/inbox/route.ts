import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { jsonData, routeError, searchParams } from "@/lib/api/route-helpers";

export async function GET(request: NextRequest) {
  const authResult = await requireApiUser(request, "inbox:manage");
  if ("error" in authResult) return authResult.error;
  try {
    const params = searchParams(request);
    const status = params.get("status");
    const channel = params.get("channel");
    const q = params.get("q")?.trim();
    const urgent = params.get("urgent");
    const handover = params.get("handover");

    const conversations = await prisma.conversation.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        ...(channel ? { channel: channel as never } : {}),
        ...(urgent === "1" ? { urgent: true } : {}),
        ...(handover === "1" ? { status: "HUMAN_HANDOVER" } : {}),
        ...(q
          ? {
              OR: [
                { customer: { name: { contains: q, mode: "insensitive" } } },
                { customer: { phone: { contains: q } } },
                { summary: { contains: q, mode: "insensitive" } },
                { tags: { has: q } },
              ],
            }
          : {}),
      },
      include: {
        customer: true,
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: [{ urgent: "desc" }, { lastMessageAt: "desc" }],
      take: 100,
    });
    return jsonData(conversations);
  } catch (error) {
    return routeError(error);
  }
}
