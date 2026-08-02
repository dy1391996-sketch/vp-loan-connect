import type { ChannelType, LeadStage, LeadTemperature } from "@prisma/client";
import { prisma } from "@/lib/db";

export function computeBookingProbability(input: {
  hasDate: boolean;
  priceAccepted?: boolean;
  photosRequested?: boolean;
  studioSelected?: boolean;
  paymentLinkRequested?: boolean;
  repeatedEngagement?: boolean;
  urgent?: boolean;
  returningCustomer?: boolean;
  responseMinutes?: number;
}): number {
  let score = 15;
  if (input.hasDate) score += 15;
  if (input.priceAccepted) score += 15;
  if (input.photosRequested) score += 8;
  if (input.studioSelected) score += 15;
  if (input.paymentLinkRequested) score += 20;
  if (input.repeatedEngagement) score += 8;
  if (input.urgent) score += 10;
  if (input.returningCustomer) score += 10;
  if (input.responseMinutes != null && input.responseMinutes <= 5) score += 5;
  return Math.max(0, Math.min(99, score));
}

export function temperatureFromProbability(p: number): LeadTemperature {
  if (p >= 70) return "HOT";
  if (p >= 40) return "WARM";
  return "COLD";
}

export async function upsertCustomerFromChannel(input: {
  channel: ChannelType;
  externalId: string;
  name?: string;
  phone?: string;
  displayName?: string;
}) {
  const existingChannel = await prisma.customerChannel.findUnique({
    where: { channel_externalId: { channel: input.channel, externalId: input.externalId } },
    include: { customer: true },
  });
  if (existingChannel) {
    if (input.name || input.phone) {
      await prisma.customer.update({
        where: { id: existingChannel.customerId },
        data: {
          name: input.name ?? existingChannel.customer.name,
          phone: input.phone ?? existingChannel.customer.phone,
        },
      });
    }
    return existingChannel.customerId;
  }

  let customerId: string | undefined;
  if (input.phone) {
    const byPhone = await prisma.customer.findUnique({ where: { phone: input.phone } });
    if (byPhone) customerId = byPhone.id;
  }

  if (!customerId) {
    const customer = await prisma.customer.create({
      data: { name: input.name, phone: input.phone },
    });
    customerId = customer.id;
  }

  await prisma.customerChannel.create({
    data: {
      customerId,
      channel: input.channel,
      externalId: input.externalId,
      displayName: input.displayName ?? input.name,
    },
  });

  return customerId;
}

export async function createOrUpdateLead(input: {
  customerId: string;
  source: ChannelType;
  name?: string;
  phone?: string;
  instagramUsername?: string;
  requiredDate?: Date;
  checkInTime?: string;
  durationHours?: number;
  guestCount?: number;
  budgetInr?: number;
  studioPreference?: string;
  aiDetectedIntent?: string;
  conversationSummary?: string;
  stage?: LeadStage;
  campaignId?: string;
}) {
  const open = await prisma.lead.findFirst({
    where: {
      customerId: input.customerId,
      stage: { notIn: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "REVIEW_REQUESTED", "LOST", "SPAM"] },
    },
    orderBy: { updatedAt: "desc" },
  });

  const probability = computeBookingProbability({
    hasDate: Boolean(input.requiredDate),
    returningCustomer: false,
  });

  if (open) {
    return prisma.lead.update({
      where: { id: open.id },
      data: {
        name: input.name ?? open.name,
        phone: input.phone ?? open.phone,
        instagramUsername: input.instagramUsername ?? open.instagramUsername,
        requiredDate: input.requiredDate ?? open.requiredDate,
        checkInTime: input.checkInTime ?? open.checkInTime,
        durationHours: input.durationHours ?? open.durationHours,
        guestCount: input.guestCount ?? open.guestCount,
        budgetInr: input.budgetInr ?? open.budgetInr,
        studioPreference: input.studioPreference ?? open.studioPreference,
        aiDetectedIntent: input.aiDetectedIntent ?? open.aiDetectedIntent,
        conversationSummary: input.conversationSummary ?? open.conversationSummary,
        stage: input.stage ?? open.stage,
        bookingProbability: Math.max(open.bookingProbability, probability),
        temperature: temperatureFromProbability(Math.max(open.bookingProbability, probability)),
        lastContactAt: new Date(),
        campaignId: input.campaignId ?? open.campaignId,
      },
    });
  }

  return prisma.lead.create({
    data: {
      customerId: input.customerId,
      source: input.source,
      name: input.name,
      phone: input.phone,
      instagramUsername: input.instagramUsername,
      requiredDate: input.requiredDate,
      checkInTime: input.checkInTime,
      durationHours: input.durationHours,
      guestCount: input.guestCount,
      budgetInr: input.budgetInr,
      studioPreference: input.studioPreference,
      aiDetectedIntent: input.aiDetectedIntent,
      conversationSummary: input.conversationSummary,
      stage: input.stage ?? "NEW_ENQUIRY",
      bookingProbability: probability,
      temperature: temperatureFromProbability(probability),
      campaignId: input.campaignId,
    },
  });
}
