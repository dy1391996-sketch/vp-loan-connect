import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { addMinutes, sha256 } from "@/lib/utils";
import type { ChannelType } from "@prisma/client";

function publicRef() {
  return randomBytes(4).toString("hex").toUpperCase();
}

function rawToken() {
  return randomBytes(24).toString("base64url");
}

export async function createChannelHandoff(input: {
  sourceChannel: ChannelType;
  sourceConversationId: string;
  sourceMessageId?: string;
  sourceCommentId?: string;
  sourceLeadId?: string;
  sourceCustomerId: string;
  createdById?: string;
  ttlHours?: number;
}) {
  const token = rawToken();
  const ref = publicRef();
  const env = getServerEnv();
  const expiresAt = addMinutes(new Date(), (input.ttlHours ?? 72) * 60);

  const handoff = await prisma.channelHandoff.create({
    data: {
      publicRef: ref,
      tokenHash: sha256(token),
      sourceChannel: input.sourceChannel,
      sourceConversationId: input.sourceConversationId,
      sourceMessageId: input.sourceMessageId,
      sourceCommentId: input.sourceCommentId,
      sourceLeadId: input.sourceLeadId,
      sourceCustomerId: input.sourceCustomerId,
      destinationChannel: "WHATSAPP",
      status: "CREATED",
      expiresAt,
      createdById: input.createdById,
      metadata: {},
    },
  });

  const path = `/go/wa/${token}`;
  const absoluteUrl = `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}${path}`;
  const prefilled = `Hi, I'm continuing my Studio99Stay enquiry. Ref: ${ref}`;

  return {
    handoff,
    token,
    publicRef: ref,
    absoluteUrl,
    prefilledMessage: prefilled,
  };
}

export async function findHandoffByRawToken(token: string) {
  if (!token || token.length < 16) return null;
  return prisma.channelHandoff.findUnique({ where: { tokenHash: sha256(token) } });
}

export async function findHandoffByPublicRef(ref: string) {
  if (!ref) return null;
  return prisma.channelHandoff.findUnique({ where: { publicRef: ref.toUpperCase() } });
}

export function extractHandoffRefFromText(text: string): string | null {
  const match = text.match(/\bRef:\s*([A-F0-9]{8})\b/i) || text.match(/\bVPNREF-([A-F0-9]{8})\b/i);
  return match?.[1]?.toUpperCase() ?? null;
}

export async function markHandoffClicked(handoffId: string) {
  const handoff = await prisma.channelHandoff.findUnique({ where: { id: handoffId } });
  if (!handoff) return null;
  if (handoff.status === "EXPIRED" || handoff.status === "CANCELLED" || handoff.expiresAt < new Date()) {
    if (handoff.status !== "EXPIRED") {
      await prisma.channelHandoff.update({ where: { id: handoffId }, data: { status: "EXPIRED" } });
    }
    return null;
  }
  if (handoff.status === "CREATED") {
    return prisma.channelHandoff.update({
      where: { id: handoffId },
      data: { status: "CLICKED", clickedAt: new Date() },
    });
  }
  return handoff;
}

export async function consumeHandoff(input: {
  publicRef: string;
  destinationConversationId: string;
  destinationCustomerId: string;
  destinationPhoneE164?: string;
}) {
  const handoff = await findHandoffByPublicRef(input.publicRef);
  if (!handoff) return { ok: false as const, reason: "not_found" };
  if (handoff.expiresAt < new Date()) {
    await prisma.channelHandoff.update({ where: { id: handoff.id }, data: { status: "EXPIRED" } });
    return { ok: false as const, reason: "expired" };
  }
  if (handoff.status === "CONSUMED") {
    // Same destination may retry — do not re-link incorrectly to another customer
    if (handoff.destinationConversationId === input.destinationConversationId) {
      return { ok: true as const, handoff, already: true as const };
    }
    return { ok: false as const, reason: "already_consumed" };
  }
  if (handoff.status === "CANCELLED") return { ok: false as const, reason: "cancelled" };

  const updated = await prisma.channelHandoff.update({
    where: { id: handoff.id },
    data: {
      status: "CONSUMED",
      consumedAt: new Date(),
      destinationConversationId: input.destinationConversationId,
      destinationCustomerId: input.destinationCustomerId,
      destinationPhoneE164: input.destinationPhoneE164,
    },
  });

  const pathParts = [handoff.sourceChannel];
  if (handoff.sourceCommentId) pathParts.unshift("INSTAGRAM_COMMENT");
  if (handoff.sourceChannel === "INSTAGRAM_DM" && !pathParts.includes("INSTAGRAM_DM")) pathParts.push("INSTAGRAM_DM");
  pathParts.push("WHATSAPP");
  const attributionPath = [...new Set(pathParts)].join(" → ");

  await prisma.conversation.update({
    where: { id: input.destinationConversationId },
    data: {
      linkedFromConversationId: handoff.sourceConversationId,
      attributionPath,
      sourceCommentId: handoff.sourceCommentId,
      tags: { push: "ig_wa_handoff" },
    },
  });

  if (handoff.sourceCustomerId && handoff.sourceCustomerId !== input.destinationCustomerId) {
    const [a, b] =
      handoff.sourceCustomerId < input.destinationCustomerId
        ? [handoff.sourceCustomerId, input.destinationCustomerId]
        : [input.destinationCustomerId, handoff.sourceCustomerId];
    await prisma.identityLink.upsert({
      where: { customerAId_customerBId: { customerAId: a, customerBId: b } },
      create: {
        customerAId: a,
        customerBId: b,
        status: "ATTRIBUTED_HANDOFF",
        method: "handoff_token",
        handoffId: handoff.id,
        verifiedAt: new Date(),
      },
      update: {
        status: "ATTRIBUTED_HANDOFF",
        method: "handoff_token",
        handoffId: handoff.id,
        verifiedAt: new Date(),
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      action: "handoff.consumed",
      entityType: "ChannelHandoff",
      entityId: handoff.id,
      after: {
        destinationConversationId: input.destinationConversationId,
        destinationCustomerId: input.destinationCustomerId,
        attributionPath,
      },
    },
  });

  return { ok: true as const, handoff: updated, already: false as const };
}

export function buildWhatsAppClickToChatUrl(phoneDigits: string, prefilled: string) {
  const digits = phoneDigits.replace(/\D/g, "");
  // Prevent open redirects — only wa.me
  return `https://wa.me/${digits}?text=${encodeURIComponent(prefilled)}`;
}

export function supportWhatsAppDigits() {
  const env = getServerEnv();
  const raw = env.SUPPORT_WHATSAPP || env.WHATSAPP_PHONE_NUMBER_ID || "";
  // Prefer explicit support WhatsApp E.164; fallback demo number for sandbox click-to-chat
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 10) return digits.startsWith("91") ? digits : `91${digits.slice(-10)}`;
  return "919999999999";
}

/** Hash helper exported for tests */
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
