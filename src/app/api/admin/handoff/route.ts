import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { writeAudit } from "@/lib/auth/session";
import { createChannelHandoff } from "@/lib/domain/handoff";
import { prisma } from "@/lib/db";
import { jsonData, parseJsonBody, routeError } from "@/lib/api/route-helpers";
import { jsonError } from "@/lib/auth/api";

const schema = z.object({
  conversationId: z.string().min(1),
  leadId: z.string().optional(),
  sourceCommentId: z.string().optional(),
  sourceMessageId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const authResult = await requireApiUser(request, "inbox:manage");
  if ("error" in authResult) return authResult.error;
  try {
    const input = await parseJsonBody(request, schema);
    const conversation = await prisma.conversation.findUniqueOrThrow({ where: { id: input.conversationId } });
    if (conversation.channel === "WHATSAPP") {
      return jsonError("Handoff is for Instagram → WhatsApp only.", 400);
    }
    const result = await createChannelHandoff({
      sourceChannel: conversation.channel,
      sourceConversationId: conversation.id,
      sourceCustomerId: conversation.customerId,
      sourceLeadId: input.leadId,
      sourceCommentId: input.sourceCommentId ?? conversation.sourceCommentId ?? undefined,
      sourceMessageId: input.sourceMessageId,
      createdById: authResult.auth.user.id,
    });
    await writeAudit({
      actorId: authResult.auth.user.id,
      action: "handoff.create",
      entityType: "ChannelHandoff",
      entityId: result.handoff.id,
      after: { publicRef: result.publicRef, sourceConversationId: conversation.id },
    });
    return jsonData(
      {
        publicRef: result.publicRef,
        absoluteUrl: result.absoluteUrl,
        prefilledMessage: result.prefilledMessage,
        expiresAt: result.handoff.expiresAt,
      },
      { status: 201 },
    );
  } catch (error) {
    return routeError(error);
  }
}
