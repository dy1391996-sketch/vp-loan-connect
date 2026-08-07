import type { Conversation, Customer, LanguagePref, Lead } from "@prisma/client";
import { prisma } from "@/lib/db";
import { detectIntent, requiresHumanHandover, type CustomerIntent } from "@/lib/ai/intent";
import { detectLanguage, replyLanguageInstruction } from "@/lib/ai/language";
import {
  extractBookingSlots,
  formatStudioRecommendations,
  mergeSlots,
  missingSlotQuestion,
  staticIntentReply,
  type BookingSlots,
} from "@/lib/ai/slots";
import { runChatCompletion } from "@/lib/integrations/openai/client";
import { sendWhatsAppText } from "@/lib/integrations/whatsapp/client";
import { searchAvailableStudios } from "@/lib/domain/availability";
import { createBookingDraft, generateBookingPaymentLink } from "@/lib/domain/bookings";
import { createOrUpdateLead, computeBookingProbability, temperatureFromProbability } from "@/lib/domain/leads";
import { scheduleFollowUpForLead } from "@/lib/domain/followups";
import { addHours } from "@/lib/utils";
import { getServerEnv } from "@/lib/env";

type ConversationMemory = {
  slots: BookingSlots;
  recommendedStudioIds?: string[];
  lastIntent?: CustomerIntent;
  corrections?: number;
};

function parseMemory(summary: string | null | undefined): ConversationMemory {
  if (!summary) return { slots: {} };
  try {
    const parsed = JSON.parse(summary) as ConversationMemory;
    if (parsed && typeof parsed === "object") {
      return { ...parsed, slots: parsed.slots ?? {} };
    }
  } catch {
    // plain text summary — ignore
  }
  return { slots: {} };
}

async function saveMemory(conversationId: string, memory: ConversationMemory, plainSummary: string) {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      summary: `${plainSummary}\n@@memory:${JSON.stringify(memory)}`.slice(0, 4000),
    },
  });
}

function loadMemoryFromSummary(summary: string | null): ConversationMemory {
  if (!summary) return { slots: {} };
  const idx = summary.lastIndexOf("@@memory:");
  if (idx >= 0) return parseMemory(summary.slice(idx + "@@memory:".length));
  return { slots: {} };
}

export async function handleInboundCustomerMessage(input: {
  conversation: Conversation & { customer: Customer };
  lead?: Lead | null;
  text: string;
  mediaType?: string | null;
}) {
  const { conversation } = input;
  let text = input.text?.trim() || "";
  if (!text && input.mediaType) {
    text = input.mediaType.startsWith("audio") || input.mediaType === "voice"
      ? "Voice note received"
      : "Image received";
  }
  if (!text) text = "(empty message)";

  const lang = detectLanguage(text) === "UNKNOWN" ? conversation.customer.preferredLanguage : detectLanguage(text);
  if (lang !== "UNKNOWN" && lang !== conversation.customer.preferredLanguage) {
    await prisma.customer.update({ where: { id: conversation.customerId }, data: { preferredLanguage: lang } });
  }

  const { intent, confidence } = detectIntent(text);
  const memory = loadMemoryFromSummary(conversation.summary);
  const extracted = extractBookingSlots(text);
  memory.slots = mergeSlots(memory.slots, extracted);
  memory.lastIntent = intent;

  // Opt-out
  if (intent === "opt_out") {
    await prisma.customer.update({
      where: { id: conversation.customerId },
      data: { optedOut: true, optedOutAt: new Date() },
    });
    await prisma.followUp.updateMany({
      where: { customerId: conversation.customerId, status: "SCHEDULED" },
      data: { status: "CANCELLED", cancelReason: "opted_out" },
    });
    const reply = staticIntentReply("opt_out", lang)!;
    await saveMemory(conversation.id, memory, "Customer opted out");
    return finalizeReply({ conversation, lead: input.lead, reply, intent, lang, confidence, aiPaused: true });
  }

  // AI paused / human handover already active
  if (conversation.aiPaused || conversation.status === "HUMAN_HANDOVER") {
    await saveMemory(conversation.id, memory, conversation.summary?.split("\n@@memory:")[0] ?? "Awaiting human");
    return {
      reply: null,
      intent,
      handedOver: true,
      skippedAi: true,
    };
  }

  // Handover triggers
  if (requiresHumanHandover(intent, text, confidence) || (memory.corrections ?? 0) >= 3) {
    const reply =
      lang === "HI"
        ? "मैं यह टीम से चेक कर रहा/रही हूँ और जल्द अपडेट दूँगा/दूँगी।"
        : lang === "HINGLISH"
          ? "Main yeh team se check karke jaldi update karta hoon."
          : "I’m checking this with the team and will update you shortly.";
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: "HUMAN_HANDOVER",
        aiPaused: true,
        urgent: true,
        pendingAction: `Handle ${intent}`,
        summary: `Handover: ${intent}. Customer said: ${text.slice(0, 280)}`,
      },
    });
    await prisma.supportTicket.create({
      data: {
        customerId: conversation.customerId,
        conversationId: conversation.id,
        subject: `Human handover · ${intent}`,
        description: text.slice(0, 2000),
        priority: intent === "complaint" || intent === "refund_request" ? "URGENT" : "HIGH",
      },
    });
    await saveMemory(conversation.id, memory, `Handover for ${intent}`);
    return finalizeReply({ conversation, lead: input.lead, reply, intent, lang, confidence, handedOver: true });
  }

  // Media acknowledgements
  if (/voice note|image received/i.test(text) && !extracted.requiredDate) {
    const reply =
      lang === "HINGLISH"
        ? "Message mil gaya. Booking ke liye date, check-in time, duration aur guests likh kar bhej dijiye."
        : lang === "HI"
          ? "संदेश मिल गया। कृपया तिथि, चेक-इन समय, अवधि और मेहमान संख्या लिखकर भेजें।"
          : "Got it. Please type your required date, check-in time, duration and guest count.";
    return finalizeReply({ conversation, lead: input.lead, reply, intent, lang, confidence });
  }

  let lead =
    input.lead ??
    (await createOrUpdateLead({
      customerId: conversation.customerId,
      source: conversation.channel === "INSTAGRAM_DM" ? "INSTAGRAM_DM" : "WHATSAPP",
      name: memory.slots.name ?? conversation.customer.name ?? undefined,
      phone: conversation.customer.phone ?? undefined,
      requiredDate: memory.slots.requiredDate ? new Date(`${memory.slots.requiredDate}T00:00:00.000Z`) : undefined,
      checkInTime: memory.slots.checkInTime,
      durationHours: memory.slots.durationHours,
      guestCount: memory.slots.guestCount,
      aiDetectedIntent: intent,
      conversationSummary: `Intent ${intent}; slots ${JSON.stringify(memory.slots)}`,
      stage: "QUALIFICATION_PENDING",
    }));

  // Static FAQ-ish intents
  const staticReply = staticIntentReply(intent, lang);
  if (staticReply && !["provide_details", "booking_request", "availability_enquiry", "price_enquiry", "select_studio", "token_payment"].includes(intent)) {
    await saveMemory(conversation.id, memory, staticReply);
    return finalizeReply({ conversation, lead, reply: staticReply, intent, lang, confidence });
  }

  // Qualification gate
  const missing = missingSlotQuestion(memory.slots, lang);
  if (missing && ["price_enquiry", "availability_enquiry", "booking_request", "provide_details", "greeting", "unknown", "amenities_enquiry"].includes(intent)) {
    const welcome =
      intent === "greeting"
        ? lang === "HINGLISH"
          ? "Namaste! VP Nest – The Studio99Stay mein aapka swagat hai."
          : lang === "HI"
            ? "नमस्ते! VP Nest – The Studio99Stay में आपका स्वागत है।"
            : "Welcome to VP Nest – The Studio99Stay."
        : null;
    const reply = welcome ? `${welcome} ${missing}` : missing;
    await saveMemory(conversation.id, memory, "Collecting booking details");
    await scheduleFollowUpForLead(lead.id, "NO_REPLY_AFTER_PRICE", 45);
    return finalizeReply({ conversation, lead, reply, intent, lang, confidence });
  }

  // Availability + recommendations
  if (
    memory.slots.requiredDate &&
    memory.slots.checkInTime &&
    memory.slots.durationHours &&
    memory.slots.guestCount &&
    (intent !== "select_studio" || !memory.slots.selectedStudioNumber)
  ) {
    const checkInAt = new Date(`${memory.slots.requiredDate}T${memory.slots.checkInTime}:00.000Z`);
    const available = await searchAvailableStudios({
      checkInAt,
      durationHours: memory.slots.durationHours,
      guestCount: memory.slots.guestCount,
      preferBalcony: memory.slots.preferBalcony,
      preferJacuzzi: memory.slots.preferJacuzzi,
      preferPremium: memory.slots.preferPremium,
    });
    const top = available.slice(0, 3);
    memory.recommendedStudioIds = top.map((s) => s.id);
    const reply = formatStudioRecommendations(top, lang);
    const probability = computeBookingProbability({
      hasDate: true,
      photosRequested: intent === "studio_photos",
      urgent: /today|aaj/i.test(text),
      returningCustomer: conversation.customer.returningCustomer,
    });
    lead = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        stage: top.length ? "AVAILABILITY_SHARED" : "QUALIFICATION_PENDING",
        bookingProbability: probability,
        temperature: temperatureFromProbability(probability),
        requiredDate: checkInAt,
        checkInTime: memory.slots.checkInTime,
        durationHours: memory.slots.durationHours,
        guestCount: memory.slots.guestCount,
        lastContactAt: new Date(),
        conversationSummary: reply.slice(0, 500),
        aiDetectedIntent: intent,
      },
    });
    if (top.length) await scheduleFollowUpForLead(lead.id, /today|aaj/i.test(text) ? "TODAY_AVAILABILITY" : "NO_REPLY_AFTER_PRICE", /today|aaj/i.test(text) ? 15 : 60);
    await saveMemory(conversation.id, memory, reply);
    return finalizeReply({ conversation, lead, reply, intent, lang, confidence });
  }

  // Studio selection → hold + payment link
  if (intent === "select_studio" || memory.slots.selectedStudioNumber || /^[123]$/.test(text.trim())) {
    const choice = Number(text.trim()) || Number(memory.slots.selectedStudioNumber);
    let studioId = memory.recommendedStudioIds?.[choice - 1];
    if (!studioId && memory.slots.selectedStudioNumber) {
      const studio = await prisma.studio.findFirst({ where: { number: memory.slots.selectedStudioNumber, active: true } });
      studioId = studio?.id;
    }
    if (!studioId || !memory.slots.requiredDate || !memory.slots.checkInTime || !memory.slots.durationHours || !memory.slots.guestCount) {
      const reply = missingSlotQuestion(memory.slots, lang) ?? "Please select option 1, 2 or 3 from the list I shared.";
      return finalizeReply({ conversation, lead, reply, intent, lang, confidence });
    }

    const checkInAt = new Date(`${memory.slots.requiredDate}T${memory.slots.checkInTime}:00.000Z`);
    try {
      const { booking } = await createBookingDraft({
        customerId: conversation.customerId,
        leadId: lead.id,
        studioId,
        checkInAt,
        durationHours: memory.slots.durationHours,
        guestCount: memory.slots.guestCount,
        createHold: true,
        idempotencyKey: `wa:${conversation.id}:${studioId}:${checkInAt.toISOString()}`,
      });
      const payment = await generateBookingPaymentLink(booking.id);
      const holdMins = getServerEnv().HOLD_MINUTES;
      const reply =
        lang === "HINGLISH"
          ? `Studio hold ho gaya ${holdMins} minutes ke liye.\nBooking: ${booking.reference}\nToken: ₹${booking.tokenAmountInr}\nPay here: ${payment.paymentLinkUrl}\nSuccessful payment ke baad booking confirm hogi.`
          : lang === "HI"
            ? `स्टूडियो ${holdMins} मिनट के लिए होल्ड है।\nबुकिंग: ${booking.reference}\nटोकन: ₹${booking.tokenAmountInr}\nभुगतान: ${payment.paymentLinkUrl}`
            : `Studio tentatively blocked for ${holdMins} minutes.\nBooking ${booking.reference}\nToken ${formatMoney(booking.tokenAmountInr)}\nPay: ${payment.paymentLinkUrl}\nYour booking will be confirmed after successful token payment.`;
      await scheduleFollowUpForLead(lead.id, "UNPAID_TOKEN", Math.max(5, holdMins - 5));
      lead = await prisma.lead.update({
        where: { id: lead.id },
        data: { stage: "PAYMENT_LINK_SENT", bookingProbability: 85, temperature: "HOT", lastContactAt: new Date() },
      });
      await saveMemory(conversation.id, memory, `Payment link sent for ${booking.reference}`);
      return finalizeReply({ conversation, lead, reply, intent, lang, confidence });
    } catch (error) {
      memory.corrections = (memory.corrections ?? 0) + 1;
      const reply =
        error instanceof Error && /available|hold|booked/i.test(error.message)
          ? lang === "HINGLISH"
            ? "Ye studio ab available nahi hai. Main fresh options check karta hoon — date same rakhein?"
            : "That studio is no longer available for the full period. Share if I should recheck with the same date."
          : "I’m checking this with the team and will update you shortly.";
      await saveMemory(conversation.id, memory, "Selection failed");
      return finalizeReply({ conversation, lead, reply, intent, lang, confidence });
    }
  }

  // Fallback: OpenAI with memory summary (not full history dump)
  const completion = await runChatCompletion({
    messages: [
      {
        role: "user",
        content: [
          replyLanguageInstruction(lang),
          `Known slots: ${JSON.stringify(memory.slots)}`,
          `Customer intent: ${intent} (confidence ${confidence})`,
          `Customer message: ${text}`,
          "Ask only for missing booking fields, one question at a time. Never invent prices or availability.",
        ].join("\n"),
      },
    ],
    temperature: 0.3,
  });
  const reply = completion.content.trim() || missingSlotQuestion(memory.slots, lang) || "Please share your required date and check-in time.";
  await saveMemory(conversation.id, memory, reply.slice(0, 400));
  return finalizeReply({ conversation, lead, reply, intent, lang, confidence });
}

async function finalizeReply(input: {
  conversation: Conversation & { customer: Customer };
  lead?: Lead | null;
  reply: string | null;
  intent: CustomerIntent;
  lang: LanguagePref;
  confidence: number;
  handedOver?: boolean;
  aiPaused?: boolean;
}) {
  if (!input.reply) {
    return { reply: null, intent: input.intent, handedOver: input.handedOver ?? false, skippedAi: true };
  }

  let externalMessageId: string | undefined;
  let providerSendStatus: "SENT" | "SKIPPED_PROVIDER_UNAVAILABLE" | "FAILED" | undefined;
  if (input.conversation.channel === "WHATSAPP" && input.conversation.customer.phone) {
    const sent = await sendWhatsAppText(input.conversation.customer.phone, input.reply);
    externalMessageId = sent.messageId;
    providerSendStatus = "SENT";
  } else if (input.conversation.channel === "INSTAGRAM_DM") {
    const { sendInstagramText } = await import("@/lib/integrations/instagram/client");
    const threadId = input.conversation.externalThreadId;
    if (threadId) {
      const sent = await sendInstagramText(threadId, input.reply.slice(0, 1000));
      externalMessageId = sent.messageId;
      providerSendStatus = sent.status;
    } else {
      providerSendStatus = "SKIPPED_PROVIDER_UNAVAILABLE";
    }
  }

  await prisma.message.create({
    data: {
      conversationId: input.conversation.id,
      direction: "OUTBOUND",
      status: providerSendStatus === "FAILED" ? "FAILED" : "SENT",
      body: input.reply,
      intent: input.intent,
      language: input.lang,
      aiGenerated: true,
      aiConfidence: input.confidence,
      externalMessageId,
      providerSendStatus,
    },
  });

  await prisma.conversation.update({
    where: { id: input.conversation.id },
    data: {
      lastMessageAt: new Date(),
      unreadCount: 0,
      ...(input.aiPaused || input.handedOver
        ? { aiPaused: true, status: "HUMAN_HANDOVER" as const }
        : { status: "AI_ACTIVE" as const }),
    },
  });

  if (input.lead) {
    await prisma.leadActivity.create({
      data: {
        leadId: input.lead.id,
        type: "ai_reply",
        summary: input.reply.slice(0, 280),
        metadata: { intent: input.intent, confidence: input.confidence },
      },
    });
  }

  return {
    reply: input.reply,
    intent: input.intent,
    handedOver: Boolean(input.handedOver),
    skippedAi: false,
  };
}

function formatMoney(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export async function suggestStaffReply(conversationId: string) {
  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: {
      customer: true,
      messages: { orderBy: { createdAt: "desc" }, take: 8 },
    },
  });
  const memory = loadMemoryFromSummary(conversation.summary);
  const lastInbound = conversation.messages.find((m) => m.direction === "INBOUND")?.body ?? "";
  const completion = await runChatCompletion({
    messages: [
      {
        role: "user",
        content: `Draft a short staff reply the human can edit.\nLanguage: ${conversation.customer.preferredLanguage}\nSlots: ${JSON.stringify(memory.slots)}\nLast customer message: ${lastInbound}\nSummary: ${conversation.summary?.split("\n@@memory:")[0] ?? ""}`,
      },
    ],
  });
  return completion.content.trim();
}

// silence unused import if tree shakes oddly
void addHours;
