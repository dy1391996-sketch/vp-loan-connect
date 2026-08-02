import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { writeAudit } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { jsonData, parseJsonBody, routeError, type RouteContext } from "@/lib/api/route-helpers";

const schema = z.object({
  action: z.enum(["pause", "resume", "handover"]),
  pendingAction: z.string().optional(),
  summary: z.string().optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  const authResult = await requireApiUser(request, "inbox:manage");
  if ("error" in authResult) return authResult.error;
  try {
    const { id } = await context.params;
    const input = await parseJsonBody(request, schema);
    const data =
      input.action === "resume"
        ? { aiPaused: false, status: "AI_ACTIVE" as const, urgent: false, pendingAction: null as string | null }
        : {
            aiPaused: true,
            status: "HUMAN_HANDOVER" as const,
            urgent: true,
            assignedStaffId: authResult.auth.user.id,
            pendingAction: input.pendingAction ?? "Staff handling",
            summary: input.summary,
          };

    const conversation = await prisma.conversation.update({ where: { id }, data });
    if (input.action === "handover") {
      await prisma.supportTicket.create({
        data: {
          conversationId: id,
          customerId: conversation.customerId,
          subject: "Manual human handover",
          description: input.summary ?? input.pendingAction ?? "Staff requested handover",
          priority: "HIGH",
          assignedStaffId: authResult.auth.user.id,
          createdById: authResult.auth.user.id,
        },
      });
    }
    await writeAudit({
      actorId: authResult.auth.user.id,
      action: `inbox.ai.${input.action}`,
      entityType: "Conversation",
      entityId: id,
      after: conversation,
    });
    return jsonData(conversation);
  } catch (error) {
    return routeError(error);
  }
}
