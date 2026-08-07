import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { PrismaClient } from "@prisma/client";
import { createHmac } from "node:crypto";
import { parseInstagramCommentPayload, parseInstagramMessagingPayload, classifyComment } from "@/lib/instagram/parse";
import { processInstagramCommentEvent, processInstagramDmEvent } from "@/lib/instagram/inbound";
import { processWhatsAppInboundMessage } from "@/lib/whatsapp/inbound";
import {
  createChannelHandoff,
  consumeHandoff,
  extractHandoffRefFromText,
  findHandoffByRawToken,
  markHandoffClicked,
  buildWhatsAppClickToChatUrl,
} from "@/lib/domain/handoff";
import { verifyMetaSignature } from "@/lib/security/signatures";
import { addMinutes } from "@/lib/utils";

const prisma = new PrismaClient();

describe("instagram parsers & classification", () => {
  it("parses IG messaging payload", () => {
    const events = parseInstagramMessagingPayload({
      object: "instagram",
      entry: [
        {
          id: "PAGE",
          messaging: [
            {
              sender: { id: "IGSID1" },
              timestamp: 1710000000,
              message: { mid: "mid.1", text: "Price for balcony?" },
            },
          ],
        },
      ],
    });
    assert.equal(events.length, 1);
    assert.equal(events[0].channel, "INSTAGRAM_DM");
    assert.equal(events[0].text, "Price for balcony?");
  });

  it("parses IG comment payload", () => {
    const events = parseInstagramCommentPayload({
      object: "instagram",
      entry: [
        {
          id: "IGBUSINESS",
          changes: [
            {
              field: "comments",
              value: {
                id: "comment_1",
                text: "Available today?",
                from: { id: "u1", username: "guest_one" },
                media: { id: "media_1" },
              },
            },
          ],
        },
      ],
    });
    assert.equal(events.length, 1);
    assert.equal(events[0].channel, "INSTAGRAM_COMMENT");
    assert.equal(events[0].sourceMetadata?.mediaId, "media_1");
  });

  it("classifies booking and spam comments", () => {
    assert.equal(classifyComment("How to book?"), "BOOKING_ENQUIRY");
    assert.equal(classifyComment("price?"), "PRICE_ENQUIRY");
    assert.equal(classifyComment("click here bit.ly crypto"), "SPAM");
    assert.equal(classifyComment("I want a human"), "HUMAN_REQUEST");
  });
});

describe("instagram inbound pipeline", () => {
  before(() => {
    process.env.INSTAGRAM_PROVIDER = "mock";
    process.env.WHATSAPP_PROVIDER = "mock";
    process.env.OPENAI_PROVIDER = "mock";
    process.env.PAYMENT_PROVIDER = "mock";
  });

  after(async () => {
    await prisma.$disconnect();
  });

  it("ingests IG DM, creates customer/conversation/message/lead and replies", async () => {
    const igUser = `ig_${crypto.randomUUID().slice(0, 8)}`;
    const result = await processInstagramDmEvent({
      channel: "INSTAGRAM_DM",
      externalEventId: `mid_${crypto.randomUUID()}`,
      externalMessageId: `mid_${crypto.randomUUID()}`,
      externalConversationId: igUser,
      externalUserId: igUser,
      externalUsername: "ig_tester",
      messageType: "text",
      text: "Hi, price for tomorrow?",
    });
    assert.equal(result.duplicate, false);
    if (result.duplicate) return;
    assert.ok(result.conversationId);
    assert.ok(result.leadId);
    const messages = await prisma.message.count({ where: { conversationId: result.conversationId } });
    assert.ok(messages >= 2);
  });

  it("ignores duplicate IG DM ids", async () => {
    const mid = `mid_dup_${crypto.randomUUID()}`;
    const igUser = `ig_${crypto.randomUUID().slice(0, 8)}`;
    const event = {
      channel: "INSTAGRAM_DM" as const,
      externalEventId: mid,
      externalMessageId: mid,
      externalConversationId: igUser,
      externalUserId: igUser,
      messageType: "text",
      text: "Hello",
    };
    const first = await processInstagramDmEvent(event);
    const second = await processInstagramDmEvent(event);
    assert.equal(first.duplicate, false);
    assert.equal(second.duplicate, true);
  });

  it("hands over complaint DMs", async () => {
    const igUser = `ig_${crypto.randomUUID().slice(0, 8)}`;
    const result = await processInstagramDmEvent({
      channel: "INSTAGRAM_DM",
      externalEventId: `mid_${crypto.randomUUID()}`,
      externalMessageId: `mid_${crypto.randomUUID()}`,
      externalConversationId: igUser,
      externalUserId: igUser,
      messageType: "text",
      text: "This is a fraud complaint",
    });
    assert.equal(result.duplicate, false);
    if (result.duplicate) return;
    assert.equal(result.handedOver, true);
  });

  it("ingests booking comment and attempts private/public reply path", async () => {
    const commentId = `cmt_${crypto.randomUUID()}`;
    const result = await processInstagramCommentEvent({
      channel: "INSTAGRAM_COMMENT",
      externalEventId: commentId,
      externalMessageId: commentId,
      externalConversationId: `comment:media:${commentId}`,
      externalUserId: `igu_${crypto.randomUUID().slice(0, 6)}`,
      externalUsername: "commenter",
      messageType: "comment",
      text: "Available today? Price?",
      sourceMetadata: { mediaId: "media_x", commentId },
    });
    assert.equal(result.duplicate, false);
    if (result.duplicate) return;
    assert.equal(result.category, "AVAILABILITY_ENQUIRY");
    assert.equal(result.replied, true);
    assert.ok(result.handoffUrl);
  });

  it("does not auto-reply to spam comments", async () => {
    const commentId = `cmt_${crypto.randomUUID()}`;
    const result = await processInstagramCommentEvent({
      channel: "INSTAGRAM_COMMENT",
      externalEventId: commentId,
      externalMessageId: commentId,
      externalConversationId: `comment:media:${commentId}`,
      externalUserId: `igu_${crypto.randomUUID().slice(0, 6)}`,
      messageType: "comment",
      text: "click here bit.ly crypto loan approval guaranteed",
      sourceMetadata: { mediaId: "media_y", commentId },
    });
    assert.equal(result.duplicate, false);
    if (result.duplicate) return;
    assert.equal(result.category, "SPAM");
    assert.equal(result.replied, false);
  });

  it("complaint comments create human handover", async () => {
    const commentId = `cmt_${crypto.randomUUID()}`;
    const result = await processInstagramCommentEvent({
      channel: "INSTAGRAM_COMMENT",
      externalEventId: commentId,
      externalMessageId: commentId,
      externalConversationId: `comment:media:${commentId}`,
      externalUserId: `igu_${crypto.randomUUID().slice(0, 6)}`,
      messageType: "comment",
      text: "Worst experience, I want refund and will complain",
      sourceMetadata: { mediaId: "media_z", commentId },
    });
    assert.equal(result.duplicate, false);
    if (result.duplicate) return;
    assert.equal(result.handedOver, true);
  });

  it("comment idempotency", async () => {
    const commentId = `cmt_dup_${crypto.randomUUID()}`;
    const event = {
      channel: "INSTAGRAM_COMMENT" as const,
      externalEventId: commentId,
      externalMessageId: commentId,
      externalConversationId: `comment:media:${commentId}`,
      externalUserId: `igu_${crypto.randomUUID().slice(0, 6)}`,
      messageType: "comment",
      text: "Location?",
      sourceMetadata: { mediaId: "media_d", commentId },
    };
    const a = await processInstagramCommentEvent(event);
    const b = await processInstagramCommentEvent(event);
    assert.equal(a.duplicate, false);
    assert.equal(b.duplicate, true);
  });
});

describe("handoff attribution", () => {
  before(() => {
    process.env.INSTAGRAM_PROVIDER = "mock";
    process.env.WHATSAPP_PROVIDER = "mock";
    process.env.OPENAI_PROVIDER = "mock";
    process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  });

  after(async () => {
    await prisma.$disconnect();
  });

  it("creates token, records click, consumes once, rejects invalid/expired", async () => {
    const customer = await prisma.customer.create({ data: { name: "Handoff Source" } });
    const conversation = await prisma.conversation.create({
      data: {
        customerId: customer.id,
        channel: "INSTAGRAM_DM",
        externalThreadId: `ig_${crypto.randomUUID().slice(0, 6)}`,
        attributionPath: "INSTAGRAM_DM",
      },
    });
    const created = await createChannelHandoff({
      sourceChannel: "INSTAGRAM_DM",
      sourceConversationId: conversation.id,
      sourceCustomerId: customer.id,
    });
    assert.ok(created.absoluteUrl.includes("/go/wa/"));
    assert.match(created.prefilledMessage, /Ref: [A-F0-9]{8}/);

    const found = await findHandoffByRawToken(created.token);
    assert.ok(found);

    const clicked = await markHandoffClicked(created.handoff.id);
    assert.ok(clicked);
    assert.ok(["CLICKED", "CREATED", "CONSUMED"].includes(clicked.status));

    const waCustomer = await prisma.customer.create({ data: { name: "WA Guest", phone: `+9198${String(Date.now()).slice(-8)}` } });
    const waConversation = await prisma.conversation.create({
      data: {
        customerId: waCustomer.id,
        channel: "WHATSAPP",
        externalThreadId: waCustomer.phone!.replace(/\D/g, ""),
      },
    });

    const first = await consumeHandoff({
      publicRef: created.publicRef,
      destinationConversationId: waConversation.id,
      destinationCustomerId: waCustomer.id,
    });
    assert.equal(first.ok, true);

    const second = await consumeHandoff({
      publicRef: created.publicRef,
      destinationConversationId: waConversation.id,
      destinationCustomerId: waCustomer.id,
    });
    assert.equal(second.ok, true);
    if (second.ok) assert.equal(second.already, true);

    const otherConv = await prisma.conversation.create({
      data: {
        customerId: waCustomer.id,
        channel: "WHATSAPP",
        externalThreadId: `other_${Date.now()}`,
      },
    });
    const third = await consumeHandoff({
      publicRef: created.publicRef,
      destinationConversationId: otherConv.id,
      destinationCustomerId: waCustomer.id,
    });
    assert.equal(third.ok, false);

    assert.equal(await findHandoffByRawToken("not-a-real-token"), null);

    const expired = await createChannelHandoff({
      sourceChannel: "INSTAGRAM_DM",
      sourceConversationId: conversation.id,
      sourceCustomerId: customer.id,
      ttlHours: 0,
    });
    await prisma.channelHandoff.update({
      where: { id: expired.handoff.id },
      data: { expiresAt: addMinutes(new Date(), -10) },
    });
    const expiredConsume = await consumeHandoff({
      publicRef: expired.publicRef,
      destinationConversationId: waConversation.id,
      destinationCustomerId: waCustomer.id,
    });
    assert.equal(expiredConsume.ok, false);

    const waUrl = buildWhatsAppClickToChatUrl("919999999999", created.prefilledMessage);
    assert.ok(waUrl.startsWith("https://wa.me/"));
    assert.ok(!waUrl.includes("javascript:"));
  });

  it("WhatsApp inbound consumes Ref marker and links source", async () => {
    const igUser = `ig_${crypto.randomUUID().slice(0, 8)}`;
    const ig = await processInstagramDmEvent({
      channel: "INSTAGRAM_DM",
      externalEventId: `mid_${crypto.randomUUID()}`,
      externalMessageId: `mid_${crypto.randomUUID()}`,
      externalConversationId: igUser,
      externalUserId: igUser,
      messageType: "text",
      text: "Book jacuzzi tomorrow",
    });
    assert.equal(ig.duplicate, false);
    if (ig.duplicate) return;

    const handoff = await createChannelHandoff({
      sourceChannel: "INSTAGRAM_DM",
      sourceConversationId: ig.conversationId,
      sourceCustomerId: (await prisma.conversation.findUniqueOrThrow({ where: { id: ig.conversationId } })).customerId,
      sourceLeadId: ig.leadId,
    });

    const phone = `98${String(Date.now()).slice(-8)}`;
    const wa = await processWhatsAppInboundMessage({
      waMessageId: `wamid_${crypto.randomUUID()}`,
      from: `91${phone}`,
      type: "text",
      text: `Hi, I'm continuing my Studio99Stay enquiry. Ref: ${handoff.publicRef}`,
    });
    assert.equal(wa.duplicate, false);
    if (wa.duplicate) return;
    assert.equal(wa.handoffAttribution?.ok, true);
    const linked = await prisma.conversation.findUniqueOrThrow({ where: { id: wa.conversationId } });
    assert.equal(linked.linkedFromConversationId, ig.conversationId);
    assert.ok(linked.attributionPath?.includes("WHATSAPP"));
  });

  it("does not attribute when Ref marker removed", async () => {
    assert.equal(extractHandoffRefFromText("Hi continuing enquiry without marker"), null);
    const phone = `97${String(Date.now()).slice(-8)}`;
    const wa = await processWhatsAppInboundMessage({
      waMessageId: `wamid_${crypto.randomUUID()}`,
      from: `91${phone}`,
      type: "text",
      text: "Hi continuing my Studio99Stay enquiry",
    });
    assert.equal(wa.duplicate, false);
    if (wa.duplicate) return;
    assert.equal(wa.handoffAttribution, undefined);
  });
});

describe("meta signature still enforced", () => {
  it("rejects invalid signatures", () => {
    const body = '{"object":"instagram"}';
    const secret = "appsecret";
    const good = createHmac("sha256", secret).update(body).digest("hex");
    assert.equal(verifyMetaSignature(body, `sha256=${good}`, secret), true);
    assert.equal(verifyMetaSignature(body, "sha256=deadbeef", secret), false);
  });
});
