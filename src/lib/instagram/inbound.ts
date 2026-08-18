import { prisma } from "@/lib/db";
import { upsertCustomerFromChannel, createOrUpdateLead } from "@/lib/domain/leads";
import { handleInboundCustomerMessage } from "@/lib/ai/orchestrator";
import { classifyComment } from "@/lib/instagram/parse";
import { privateReplyToComment, publicReplyToComment, sendInstagramText } from "@/lib/integrations/instagram/client";
import { createChannelHandoff, supportWhatsAppDigits } from "@/lib/domain/handoff";
import type { NormalizedInboundEvent } from "@/lib/messaging/types";
import { detectIntent, requiresHumanHandover } from "@/lib/ai/intent";

export async function processInstagramDmEvent(event: NormalizedInboundEvent) {
  const existing = await prisma.message.findUnique({ where: { externalMessageId: event.externalMessageId } });
  if (existing) return { duplicate: true as const };

  const customerId = await upsertCustomerFromChannel({
    channel: "INSTAGRAM_DM",
    externalId: event.externalUserId,
    name: event.externalUsername,
    displayName: event.externalUsername,
  });

  let conversation = await prisma.conversation.findFirst({
    where: { customerId, channel: "INSTAGRAM_DM", externalThreadId: event.externalConversationId ?? event.externalUserId },
    include: { customer: true },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        customerId,
        channel: "INSTAGRAM_DM",
        externalThreadId: event.externalConversationId ?? event.externalUserId,
        status: "AI_ACTIVE",
        lastMessageAt: new Date(),
        attributionPath: "INSTAGRAM_DM",
        tags: ["instagram"],
      },
      include: { customer: true },
    });
  } else {
    conversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), unreadCount: { increment: 1 } },
      include: { customer: true },
    });
  }

  const body =
    event.text ??
    (event.media ? `${event.media.mimeType ?? "media"} received` : "(instagram message)");

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "INBOUND",
      status: "RECEIVED",
      body,
      mediaType: event.media?.mimeType ?? event.messageType,
      mediaUrl: event.media?.url,
      externalMessageId: event.externalMessageId,
      replyToExternalId: event.replyTo,
      metadata: {
        externalUserId: event.externalUserId,
        username: event.externalUsername,
        timestamp: event.timestamp,
      },
    },
  });

  const lead = await createOrUpdateLead({
    customerId,
    source: "INSTAGRAM_DM",
    name: event.externalUsername,
    instagramUsername: event.externalUsername,
    aiDetectedIntent: detectIntent(body).intent,
  });

  // Channel-aware: after AI, also offer WhatsApp handoff for booking intents
  const result = await handleInboundCustomerMessage({
    conversation,
    lead,
    text: body,
    mediaType: event.media?.mimeType ?? event.messageType,
  });

  let handoffUrl: string | undefined;
  const intent = detectIntent(body).intent;
  if (!result.handedOver && !result.skippedAi && ["price_enquiry", "availability_enquiry", "booking_request", "provide_details"].includes(intent)) {
    const handoff = await createChannelHandoff({
      sourceChannel: "INSTAGRAM_DM",
      sourceConversationId: conversation.id,
      sourceLeadId: lead.id,
      sourceCustomerId: customerId,
      sourceMessageId: event.externalMessageId,
    });
    handoffUrl = handoff.absoluteUrl;
    const cta =
      `For booking confirmation and payment on WhatsApp: ${handoff.absoluteUrl}\n` +
      `(Prefill includes Ref: ${handoff.publicRef})`;
    const send = await sendInstagramText(event.externalUserId, cta.slice(0, 1000));
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "OUTBOUND",
        status: send.ok ? "SENT" : "FAILED",
        body: cta,
        aiGenerated: true,
        externalMessageId: send.messageId ?? `ig_handoff_${event.externalMessageId}`,
        providerSendStatus: send.status,
        metadata: send.missing ? { missing: send.missing, error: send.error } : { handoffRef: handoff.publicRef },
      },
    });
  }

  return {
    duplicate: false as const,
    conversationId: conversation.id,
    leadId: lead.id,
    handoffUrl,
    ...result,
  };
}

export async function processInstagramCommentEvent(event: NormalizedInboundEvent) {
  const existingMsg = await prisma.message.findUnique({ where: { externalMessageId: event.externalMessageId } });
  if (existingMsg) return { duplicate: true as const };

  const existingComment = await prisma.socialComment.findUnique({ where: { externalCommentId: event.externalMessageId } });
  if (existingComment) return { duplicate: true as const };

  const text = event.text ?? "";
  const category = classifyComment(text);
  const { intent, confidence } = detectIntent(text);

  const customerId = await upsertCustomerFromChannel({
    channel: "INSTAGRAM_COMMENT",
    externalId: event.externalUserId,
    name: event.externalUsername,
    displayName: event.externalUsername,
  });

  const threadId = event.externalConversationId ?? `comment:${event.externalUserId}`;
  let conversation = await prisma.conversation.findFirst({
    where: { channel: "INSTAGRAM_COMMENT", externalThreadId: threadId },
    include: { customer: true },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        customerId,
        channel: "INSTAGRAM_COMMENT",
        externalThreadId: threadId,
        status: "AI_ACTIVE",
        lastMessageAt: new Date(),
        attributionPath: "INSTAGRAM_COMMENT",
        sourceCommentId: event.externalMessageId,
        sourceMediaId: event.sourceMetadata?.mediaId,
        tags: ["instagram", "comment"],
      },
      include: { customer: true },
    });
  }

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "INBOUND",
      status: "RECEIVED",
      body: text || "(comment)",
      externalMessageId: event.externalMessageId,
      intent: category,
      metadata: {
        mediaId: event.sourceMetadata?.mediaId,
        username: event.externalUsername,
        parentId: event.externalParentId,
      },
    },
  });

  const social = await prisma.socialComment.create({
    data: {
      externalCommentId: event.externalMessageId,
      authorUsername: event.externalUsername,
      body: text || "(comment)",
      category,
      requiresHuman: ["COMPLAINT", "ABUSIVE", "HUMAN_REQUEST"].includes(category) || requiresHumanHandover(intent, text, confidence),
    },
  });

  let leadId: string | undefined;
  if (!["SPAM", "ABUSIVE"].includes(category)) {
    const lead = await createOrUpdateLead({
      customerId,
      source: "INSTAGRAM_COMMENT",
      name: event.externalUsername,
      instagramUsername: event.externalUsername,
      aiDetectedIntent: intent,
      conversationSummary: `IG comment: ${text.slice(0, 200)}`,
    });
    leadId = lead.id;
    await prisma.socialComment.update({ where: { id: social.id }, data: { leadId: lead.id } });
  }

  if (category === "SPAM") {
    return { duplicate: false as const, conversationId: conversation.id, leadId, category, replied: false, reason: "spam" };
  }

  if (social.requiresHuman || category === "COMPLAINT" || category === "ABUSIVE" || category === "HUMAN_REQUEST") {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { aiPaused: true, status: "HUMAN_HANDOVER", urgent: true, pendingAction: `Comment ${category}` },
    });
    await prisma.supportTicket.create({
      data: {
        customerId,
        conversationId: conversation.id,
        subject: `IG comment · ${category}`,
        description: text.slice(0, 2000),
        priority: category === "COMPLAINT" || category === "ABUSIVE" ? "URGENT" : "HIGH",
      },
    });
    return { duplicate: false as const, conversationId: conversation.id, leadId, category, handedOver: true, replied: false };
  }

  // Booking/price/availability — try private reply, else safe public fallback
  const isEnquiry = ["BOOKING_ENQUIRY", "PRICE_ENQUIRY", "AVAILABILITY_ENQUIRY", "LOCATION_ENQUIRY"].includes(category);
  if (!isEnquiry) {
    return { duplicate: false as const, conversationId: conversation.id, leadId, category, replied: false, reason: "no_auto_reply" };
  }

  const handoff = leadId
    ? await createChannelHandoff({
        sourceChannel: "INSTAGRAM_COMMENT",
        sourceConversationId: conversation.id,
        sourceCommentId: event.externalMessageId,
        sourceLeadId: leadId,
        sourceCustomerId: customerId,
      })
    : null;

  const privateText = handoff
    ? `Thanks for your enquiry about VP Nest – The Studio99Stay. Continue on WhatsApp: ${handoff.absoluteUrl}`
    : `Thanks for your enquiry about VP Nest – The Studio99Stay. Please DM us with your date and duration.`;

  const privateResult = await privateReplyToComment(event.externalMessageId, privateText);
  let publicText: string | null = null;
  let publicResult = null;

  if (privateResult.ok) {
    publicText = "Thanks for your enquiry. We’ve sent you the details privately.";
    publicResult = await publicReplyToComment(event.externalMessageId, publicText);
  } else {
    publicText = "Thanks for your enquiry! Please DM us for pricing and availability — we’ll help you book.";
    publicResult = await publicReplyToComment(event.externalMessageId, publicText);
  }

  await prisma.socialComment.update({
    where: { id: social.id },
    data: {
      publicReply: publicText,
      replyApproved: true,
      repliedAt: new Date(),
    },
  });

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "OUTBOUND",
      status: privateResult.ok || publicResult?.ok ? "SENT" : "FAILED",
      body: privateResult.ok ? privateText : publicText,
      aiGenerated: true,
      providerSendStatus: privateResult.ok ? privateResult.status : publicResult?.status,
      metadata: {
        privateReply: { status: privateResult.status, missing: privateResult.missing, error: privateResult.error },
        publicReply: publicResult ? { status: publicResult.status, error: publicResult.error } : null,
        handoffRef: handoff?.publicRef,
      },
    },
  });

  // Also open/link an Instagram DM conversation attribution when private reply succeeds
  if (privateResult.ok && handoff) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { attributionPath: "INSTAGRAM_COMMENT → INSTAGRAM_DM", tags: { push: "comment_to_dm" } },
    });
  }

  return {
    duplicate: false as const,
    conversationId: conversation.id,
    leadId,
    category,
    replied: true,
    privateReply: privateResult,
    publicReply: publicResult,
    handoffUrl: handoff?.absoluteUrl,
    supportWa: supportWhatsAppDigits(),
  };
}
