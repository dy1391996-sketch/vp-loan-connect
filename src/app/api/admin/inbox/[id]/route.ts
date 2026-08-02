import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { writeAudit } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { jsonData, parseJsonBody, routeError, type RouteContext } from "@/lib/api/route-helpers";
import { suggestStaffReply } from "@/lib/ai/orchestrator";

export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await requireApiUser(request, "inbox:manage");
  if ("error" in authResult) return authResult.error;
  try {
    const { id } = await context.params;
    const conversation = await prisma.conversation.findUniqueOrThrow({
      where: { id },
      include: {
        customer: { include: { leads: { orderBy: { updatedAt: "desc" }, take: 3 }, bookings: { orderBy: { createdAt: "desc" }, take: 3 } } },
        messages: { orderBy: { createdAt: "asc" }, take: 200 },
        notes: { include: { author: true }, orderBy: { createdAt: "desc" }, take: 50 },
      },
    });
    await prisma.conversation.update({ where: { id }, data: { unreadCount: 0 } });
    const suggestion = await suggestStaffReply(id).catch(() => "");
    return jsonData({ conversation, suggestion });
  } catch (error) {
    return routeError(error);
  }
}

const patchSchema = z.object({
  aiPaused: z.boolean().optional(),
  status: z.enum(["OPEN", "AI_ACTIVE", "HUMAN_HANDOVER", "RESOLVED", "ARCHIVED"]).optional(),
  assignedStaffId: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  urgent: z.boolean().optional(),
  pendingAction: z.string().nullable().optional(),
  summary: z.string().optional(),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authResult = await requireApiUser(request, "inbox:manage");
  if ("error" in authResult) return authResult.error;
  try {
    const { id } = await context.params;
    const input = await parseJsonBody(request, patchSchema);
    const before = await prisma.conversation.findUniqueOrThrow({ where: { id } });
    const conversation = await prisma.conversation.update({
      where: { id },
      data: {
        aiPaused: input.aiPaused,
        status: input.status,
        assignedStaffId: input.assignedStaffId === null ? null : input.assignedStaffId,
        tags: input.tags,
        urgent: input.urgent,
        pendingAction: input.pendingAction === null ? null : input.pendingAction,
        summary: input.summary,
        ...(input.aiPaused === false && !input.status ? { status: "AI_ACTIVE" } : {}),
        ...(input.aiPaused === true && !input.status ? { status: "HUMAN_HANDOVER" } : {}),
      },
    });
    await writeAudit({
      actorId: authResult.auth.user.id,
      action: "inbox.update",
      entityType: "Conversation",
      entityId: id,
      before,
      after: conversation,
    });
    return jsonData(conversation);
  } catch (error) {
    return routeError(error);
  }
}
