import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { processWhatsAppInboundMessage } from "@/lib/whatsapp/inbound";
import { processInstagramCommentEvent, processInstagramDmEvent } from "@/lib/instagram/inbound";
import { createChannelHandoff } from "@/lib/domain/handoff";
import { jsonData, parseJsonBody, routeError } from "@/lib/api/route-helpers";
import { jsonError } from "@/lib/auth/api";
import { getServerEnv } from "@/lib/env";
import { prisma } from "@/lib/db";

const schema = z.object({
  kind: z.enum(["whatsapp", "instagram_dm", "instagram_comment", "whatsapp_handoff", "comment_to_dm"]).default("whatsapp"),
  from: z.string().optional(),
  igUserId: z.string().optional(),
  text: z.string().min(1),
  profileName: z.string().optional(),
  username: z.string().optional(),
  mediaId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const authResult = await requireApiUser(request, "inbox:manage");
  if ("error" in authResult) return authResult.error;
  try {
    const env = getServerEnv();
    if (env.NODE_ENV === "production" && env.WHATSAPP_PROVIDER !== "mock" && env.INSTAGRAM_PROVIDER !== "mock") {
      return jsonError("Simulate endpoint disabled in live production.", 403);
    }
    const input = await parseJsonBody(request, schema);
    const kind = input.kind;

    if (kind === "whatsapp" || kind === "whatsapp_handoff") {
      const from = (input.from ?? "9876543210").replace(/\D/g, "");
      const result = await processWhatsAppInboundMessage({
        waMessageId: `sim_wa_${crypto.randomUUID()}`,
        from,
        profileName: input.profileName ?? "Simulated Guest",
        type: "text",
        text: input.text,
        timestamp: String(Math.floor(Date.now() / 1000)),
      });
      return jsonData({ sandbox: true, kind, ...result }, { status: 201 });
    }

    if (kind === "instagram_dm" || kind === "comment_to_dm") {
      const igUserId = input.igUserId ?? `ig_${crypto.randomUUID().slice(0, 8)}`;
      const result = await processInstagramDmEvent({
        channel: "INSTAGRAM_DM",
        externalEventId: `sim_ig_${crypto.randomUUID()}`,
        externalMessageId: `sim_ig_${crypto.randomUUID()}`,
        externalConversationId: igUserId,
        externalUserId: igUserId,
        externalUsername: input.username ?? input.profileName,
        messageType: "text",
        text: input.text,
        timestamp: String(Date.now()),
      });
      return jsonData({ sandbox: true, kind, ...result }, { status: 201 });
    }

    if (kind === "instagram_comment") {
      const igUserId = input.igUserId ?? `igc_${crypto.randomUUID().slice(0, 8)}`;
      const commentId = `sim_cmt_${crypto.randomUUID()}`;
      const result = await processInstagramCommentEvent({
        channel: "INSTAGRAM_COMMENT",
        externalEventId: commentId,
        externalMessageId: commentId,
        externalConversationId: `comment:media_demo:${igUserId}`,
        externalUserId: igUserId,
        externalUsername: input.username ?? input.profileName,
        messageType: "comment",
        text: input.text,
        sourceMetadata: { mediaId: input.mediaId ?? "media_demo", commentId },
        timestamp: String(Date.now()),
      });
      return jsonData({ sandbox: true, kind, publicRef: result.handoffUrl ? undefined : undefined, ...result }, { status: 201 });
    }

    // helper: create handoff from latest IG conversation for testing
    const ig = await prisma.conversation.findFirst({
      where: { channel: { in: ["INSTAGRAM_DM", "INSTAGRAM_COMMENT"] } },
      orderBy: { updatedAt: "desc" },
    });
    if (!ig) return jsonError("No Instagram conversation to hand off.", 400);
    const handoff = await createChannelHandoff({
      sourceChannel: ig.channel,
      sourceConversationId: ig.id,
      sourceCustomerId: ig.customerId,
      createdById: authResult.auth.user.id,
    });
    return jsonData({ sandbox: true, kind, ...handoff }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
