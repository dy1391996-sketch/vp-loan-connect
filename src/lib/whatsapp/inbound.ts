import { prisma } from "@/lib/db";
import { upsertCustomerFromChannel, createOrUpdateLead } from "@/lib/domain/leads";
import { handleInboundCustomerMessage } from "@/lib/ai/orchestrator";
import { normalizeIndianMobile } from "@/lib/utils";

export type ParsedWhatsAppMessage = {
  waMessageId: string;
  from: string; // digits
  profileName?: string;
  timestamp?: string;
  type: string;
  text?: string;
  mediaId?: string;
  mediaMime?: string;
};

export function parseWhatsAppWebhookPayload(payload: unknown): ParsedWhatsAppMessage[] {
  const out: ParsedWhatsAppMessage[] = [];
  const root = payload as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
          messages?: Array<{
            id: string;
            from: string;
            timestamp?: string;
            type: string;
            text?: { body?: string };
            image?: { id?: string; mime_type?: string };
            audio?: { id?: string; mime_type?: string };
            button?: { text?: string };
            interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
          }>;
        };
      }>;
    }>;
  };

  for (const entry of root.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value?.messages?.length) continue;
      const contactName = value.contacts?.[0]?.profile?.name;
      for (const msg of value.messages) {
        let text = msg.text?.body;
        if (!text && msg.button?.text) text = msg.button.text;
        if (!text && msg.interactive?.button_reply?.title) text = msg.interactive.button_reply.title;
        if (!text && msg.interactive?.list_reply?.title) text = msg.interactive.list_reply.title;
        out.push({
          waMessageId: msg.id,
          from: msg.from,
          profileName: contactName,
          timestamp: msg.timestamp,
          type: msg.type,
          text,
          mediaId: msg.image?.id ?? msg.audio?.id,
          mediaMime: msg.image?.mime_type ?? msg.audio?.mime_type,
        });
      }
    }
  }
  return out;
}

export async function processWhatsAppInboundMessage(msg: ParsedWhatsAppMessage) {
  const existing = await prisma.message.findUnique({ where: { externalMessageId: msg.waMessageId } });
  if (existing) return { duplicate: true as const };

  let phone: string;
  try {
    phone = normalizeIndianMobile(msg.from);
  } catch {
    phone = `+${msg.from.replace(/\D/g, "")}`;
  }

  const customerId = await upsertCustomerFromChannel({
    channel: "WHATSAPP",
    externalId: msg.from.replace(/\D/g, ""),
    name: msg.profileName,
    phone,
    displayName: msg.profileName,
  });

  if (/^\s*stop\s*$/i.test(msg.text ?? "")) {
    await prisma.customer.update({
      where: { id: customerId },
      data: { optedOut: true, optedOutAt: new Date() },
    });
  }

  let conversation = await prisma.conversation.findFirst({
    where: { customerId, channel: "WHATSAPP" },
    include: { customer: true },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        customerId,
        channel: "WHATSAPP",
        externalThreadId: msg.from.replace(/\D/g, ""),
        status: "AI_ACTIVE",
        lastMessageAt: new Date(),
      },
      include: { customer: true },
    });
  } else {
    conversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        unreadCount: { increment: 1 },
      },
      include: { customer: true },
    });
  }

  const body =
    msg.text ??
    (msg.type === "image"
      ? "Image received"
      : msg.type === "audio"
        ? "Voice note received"
        : msg.type === "sticker"
          ? "Sticker received"
          : `(${msg.type} message)`);

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "INBOUND",
      status: "RECEIVED",
      body,
      mediaType: msg.mediaMime ?? msg.type,
      externalMessageId: msg.waMessageId,
      metadata: { from: msg.from, timestamp: msg.timestamp },
    },
  });

  const lead = await createOrUpdateLead({
    customerId,
    source: "WHATSAPP",
    name: msg.profileName,
    phone,
    aiDetectedIntent: undefined,
  });

  const result = await handleInboundCustomerMessage({
    conversation,
    lead,
    text: body,
    mediaType: msg.mediaMime ?? msg.type,
  });

  return { duplicate: false as const, conversationId: conversation.id, leadId: lead.id, ...result };
}
