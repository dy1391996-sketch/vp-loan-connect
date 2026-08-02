import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { writeAudit } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { sendWhatsAppText } from "@/lib/integrations/whatsapp/client";
import { jsonData, parseJsonBody, routeError, type RouteContext } from "@/lib/api/route-helpers";

const sendSchema = z.object({
  body: z.string().min(1).max(4000),
  pauseAi: z.boolean().optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  const authResult = await requireApiUser(request, "inbox:manage");
  if ("error" in authResult) return authResult.error;
  try {
    const { id } = await context.params;
    const input = await parseJsonBody(request, sendSchema);
    const conversation = await prisma.conversation.findUniqueOrThrow({
      where: { id },
      include: { customer: true },
    });

    let externalMessageId: string | undefined;
    if (conversation.channel === "WHATSAPP" && conversation.customer.phone) {
      const sent = await sendWhatsAppText(conversation.customer.phone, input.body);
      externalMessageId = sent.messageId;
    }

    const message = await prisma.message.create({
      data: {
        conversationId: id,
        direction: "OUTBOUND",
        status: "SENT",
        body: input.body,
        aiGenerated: false,
        externalMessageId,
        createdById: authResult.auth.user.id,
      },
    });

    await prisma.conversation.update({
      where: { id },
      data: {
        lastMessageAt: new Date(),
        unreadCount: 0,
        ...(input.pauseAi !== false
          ? { aiPaused: true, status: "HUMAN_HANDOVER", assignedStaffId: authResult.auth.user.id }
          : {}),
      },
    });

    await writeAudit({
      actorId: authResult.auth.user.id,
      action: "inbox.send",
      entityType: "Message",
      entityId: message.id,
      after: message,
    });

    return jsonData(message, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
