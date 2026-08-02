import type { FollowUpType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { addMinutes } from "@/lib/utils";

export async function scheduleFollowUpForLead(leadId: string, type: FollowUpType, delayMinutes: number) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { customer: true } });
  if (!lead || lead.customer.optedOut) return null;
  if (["CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "LOST", "SPAM"].includes(lead.stage)) return null;

  // Cancel older same-type scheduled follow-ups
  await prisma.followUp.updateMany({
    where: { leadId, type, status: "SCHEDULED" },
    data: { status: "CANCELLED", cancelReason: "rescheduled" },
  });

  const templateKey =
    type === "UNPAID_TOKEN"
      ? "payment_reminder"
      : type === "PRE_ARRIVAL"
        ? "pre_arrival"
        : type === "REVIEW"
          ? "review_request"
          : type === "CHECKOUT"
            ? "checkout_reminder"
            : "welcome_followup";

  return prisma.followUp.create({
    data: {
      customerId: lead.customerId,
      leadId,
      type,
      channel: lead.source === "INSTAGRAM_DM" ? "WHATSAPP" : lead.source === "WHATSAPP" ? "WHATSAPP" : "WHATSAPP",
      scheduledAt: addMinutes(new Date(), delayMinutes),
      templateKey,
      maxAttempts: type === "UNPAID_TOKEN" ? 2 : 3,
      payload: { stage: lead.stage, temperature: lead.temperature },
    },
  });
}

export async function cancelLeadFollowUps(leadId: string, reason: string) {
  await prisma.followUp.updateMany({
    where: { leadId, status: "SCHEDULED" },
    data: { status: "CANCELLED", cancelReason: reason },
  });
}

export async function processDueFollowUps(limit = 50) {
  const due = await prisma.followUp.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
    include: { customer: true, lead: true },
    orderBy: { scheduledAt: "asc" },
    take: limit,
  });

  const { sendWhatsAppText, sendWhatsAppTemplate } = await import("@/lib/integrations/whatsapp/client");
  const { releaseTemporaryHold } = await import("@/lib/domain/holds");

  let sent = 0;
  for (const item of due) {
    if (item.customer.optedOut) {
      await prisma.followUp.update({
        where: { id: item.id },
        data: { status: "SKIPPED", cancelReason: "opted_out" },
      });
      continue;
    }
    if (item.lead && ["CONFIRMED", "LOST", "SPAM", "CHECKED_IN"].includes(item.lead.stage)) {
      await prisma.followUp.update({
        where: { id: item.id },
        data: { status: "CANCELLED", cancelReason: `lead_${item.lead.stage.toLowerCase()}` },
      });
      continue;
    }
    if (item.attempt >= item.maxAttempts) {
      await prisma.followUp.update({
        where: { id: item.id },
        data: { status: "SKIPPED", cancelReason: "max_attempts" },
      });
      if (item.type === "UNPAID_TOKEN" && item.leadId) {
        const booking = await prisma.booking.findFirst({
          where: { leadId: item.leadId, status: { in: ["HOLD", "TOKEN_PENDING"] } },
          orderBy: { createdAt: "desc" },
        });
        if (booking?.holdId) await releaseTemporaryHold(booking.holdId, "expired");
      }
      continue;
    }

    try {
      const phone = item.customer.phone;
      if (!phone) throw new Error("No phone");

      // Inside a recent conversation we prefer free-form; outside window templates are required in production.
      // For unpaid token we always try a short free-form first in mock / when conversation is fresh.
      const conversation = await prisma.conversation.findFirst({
        where: { customerId: item.customerId, channel: "WHATSAPP" },
        orderBy: { lastMessageAt: "desc" },
      });
      const windowOpen =
        conversation?.lastMessageAt && Date.now() - conversation.lastMessageAt.getTime() < 24 * 60 * 60 * 1000;

      const body = followUpCopy(item.type, item.customer.preferredLanguage);
      if (windowOpen) {
        await sendWhatsAppText(phone, body);
      } else if (item.templateKey) {
        await sendWhatsAppTemplate({ toE164: phone, templateName: item.templateKey });
      } else {
        await prisma.followUp.update({
          where: { id: item.id },
          data: { status: "SKIPPED", cancelReason: "outside_messaging_window_no_template" },
        });
        continue;
      }

      await prisma.followUp.update({
        where: { id: item.id },
        data: { status: "SENT", sentAt: new Date(), attempt: { increment: 1 } },
      });
      sent += 1;
    } catch {
      await prisma.followUp.update({
        where: { id: item.id },
        data: { status: "FAILED", attempt: { increment: 1 } },
      });
    }
  }

  return { processed: due.length, sent };
}

function followUpCopy(type: FollowUpType, lang: string) {
  if (type === "UNPAID_TOKEN") {
    return lang === "HINGLISH" || lang === "HI"
      ? "Namaste, token payment pending hai. Link se payment complete karein — hold expire hone wala hai."
      : "Hi — your token payment is still pending. Please complete payment before the studio hold expires.";
  }
  if (type === "TODAY_AVAILABILITY") {
    return lang === "HINGLISH" || lang === "HI"
      ? "Aaj ke liye studios fast fill ho rahe hain. Date/time confirm karoon?"
      : "Studios for today fill quickly. Should I recheck live availability for you?";
  }
  if (type === "PRE_ARRIVAL") {
    return "Reminder: your VP Nest check-in is coming up. Please keep government ID ready. Location: Gaur City Center, Greater Noida West.";
  }
  return lang === "HINGLISH" || lang === "HI"
    ? "Namaste! Kya main available studios check karoon?"
    : "Hi! Would you like me to check available studios?";
}
