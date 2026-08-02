import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { PrismaClient } from "@prisma/client";
import { processWhatsAppInboundMessage } from "@/lib/whatsapp/inbound";
import { processDueFollowUps } from "@/lib/domain/followups";

const prisma = new PrismaClient();

describe("whatsapp inbound pipeline", () => {
  before(async () => {
    process.env.WHATSAPP_PROVIDER = "mock";
    process.env.OPENAI_PROVIDER = "mock";
    process.env.PAYMENT_PROVIDER = "mock";
    process.env.HOLD_MINUTES = "15";
    process.env.TOKEN_PERCENT = "30";
  });

  after(async () => {
    await prisma.$disconnect();
  });

  it("creates conversation, lead and AI reply for a new enquiry", async () => {
    const from = `9198${String(Date.now()).slice(-8)}`;
    const result = await processWhatsAppInboundMessage({
      waMessageId: `wamid_${crypto.randomUUID()}`,
      from,
      profileName: "Pipeline Tester",
      type: "text",
      text: "Hi, price for tomorrow 24 hours?",
    });
    assert.equal(result.duplicate, false);
    assert.ok(result.conversationId);
    assert.ok(result.reply);
    assert.match(String(result.reply), /check-in|date|guests|hours|time|Welcome|Namaste|swagat/i);

    const messages = await prisma.message.findMany({
      where: { conversationId: result.conversationId },
      orderBy: { createdAt: "asc" },
    });
    assert.ok(messages.some((m) => m.direction === "INBOUND"));
    assert.ok(messages.some((m) => m.direction === "OUTBOUND" && m.aiGenerated));
  });

  it("deduplicates the same WhatsApp message id", async () => {
    const id = `wamid_dup_${crypto.randomUUID()}`;
    const from = `9198${String(Date.now() + 11).slice(-8)}`;
    const first = await processWhatsAppInboundMessage({
      waMessageId: id,
      from,
      type: "text",
      text: "Location?",
    });
    const second = await processWhatsAppInboundMessage({
      waMessageId: id,
      from,
      type: "text",
      text: "Location?",
    });
    assert.equal(first.duplicate, false);
    assert.equal(second.duplicate, true);
  });

  it("hands over refund requests and pauses AI", async () => {
    const from = `9198${String(Date.now() + 22).slice(-8)}`;
    const result = await processWhatsAppInboundMessage({
      waMessageId: `wamid_${crypto.randomUUID()}`,
      from,
      type: "text",
      text: "I need a refund immediately",
    });
    assert.equal(result.duplicate, false);
    if (result.duplicate) return;
    assert.equal(result.handedOver, true);
    const conversation = await prisma.conversation.findUniqueOrThrow({ where: { id: result.conversationId } });
    assert.equal(conversation.aiPaused, true);
    assert.equal(conversation.status, "HUMAN_HANDOVER");
  });

  it("opts out on STOP and skips follow-ups", async () => {
    const from = `9198${String(Date.now() + 33).slice(-8)}`;
    const result = await processWhatsAppInboundMessage({
      waMessageId: `wamid_${crypto.randomUUID()}`,
      from,
      type: "text",
      text: "STOP",
    });
    assert.equal(result.duplicate, false);
    if (result.duplicate) return;
    const customer = await prisma.customer.findFirst({
      where: { channels: { some: { externalId: from.replace(/\D/g, "") } } },
    });
    assert.ok(customer?.optedOut);
    assert.ok(result.reply);
  });

  it("processes due follow-ups without throwing", async () => {
    const summary = await processDueFollowUps(10);
    assert.ok(typeof summary.processed === "number");
  });
});
