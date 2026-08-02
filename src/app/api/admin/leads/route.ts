import { z } from "zod";
import type { NextRequest } from "next/server";
import { ChannelType, LeadStage, LeadTemperature } from "@prisma/client";
import { requireApiUser } from "@/lib/auth/api";
import { writeAudit } from "@/lib/auth/session";
import { createOrUpdateLead } from "@/lib/domain/leads";
import { prisma } from "@/lib/db";
import { jsonData, parseJsonBody, routeError, searchParams } from "@/lib/api/route-helpers";

const leadCreateSchema = z.object({
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email().optional(),
  source: z.nativeEnum(ChannelType).default("DIRECT"),
  name: z.string().optional(),
  phone: z.string().optional(),
  instagramUsername: z.string().optional(),
  requiredDate: z.string().datetime().optional(),
  checkInTime: z.string().optional(),
  durationHours: z.number().int().positive().optional(),
  guestCount: z.number().int().positive().optional(),
  budgetInr: z.number().int().nonnegative().optional(),
  studioPreference: z.string().optional(),
  aiDetectedIntent: z.string().optional(),
  conversationSummary: z.string().optional(),
  stage: z.nativeEnum(LeadStage).optional(),
  campaignId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const authResult = await requireApiUser(request, "leads:manage");
  if ("error" in authResult) return authResult.error;
  const params = searchParams(request);
  const stage = params.get("stage") as LeadStage | null;
  const temp = params.get("temp") as LeadTemperature | null;
  const leads = await prisma.lead.findMany({
    where: {
      ...(stage ? { stage } : {}),
      ...(temp ? { temperature: temp } : {}),
    },
    include: { customer: true, assignedStaff: { select: { id: true, name: true } }, bookings: { select: { id: true, reference: true, status: true } } },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return jsonData(leads);
}

export async function POST(request: NextRequest) {
  const authResult = await requireApiUser(request, "leads:manage");
  if ("error" in authResult) return authResult.error;
  try {
    const input = await parseJsonBody(request, leadCreateSchema);
    let customerId = input.customerId;
    if (!customerId) {
      if (!input.customerName && !input.customerPhone && !input.customerEmail) throw new Error("Provide customerId or customer details.");
      const customer =
        input.customerPhone
          ? await prisma.customer.upsert({
              where: { phone: input.customerPhone },
              create: { name: input.customerName ?? input.name, phone: input.customerPhone, email: input.customerEmail, createdById: authResult.auth.user.id },
              update: { name: input.customerName ?? input.name, email: input.customerEmail },
            })
          : await prisma.customer.create({
              data: { name: input.customerName ?? input.name, email: input.customerEmail, createdById: authResult.auth.user.id },
            });
      customerId = customer.id;
    }

    const lead = await createOrUpdateLead({
      customerId,
      source: input.source,
      name: input.name ?? input.customerName,
      phone: input.phone ?? input.customerPhone,
      instagramUsername: input.instagramUsername,
      requiredDate: input.requiredDate ? new Date(input.requiredDate) : undefined,
      checkInTime: input.checkInTime,
      durationHours: input.durationHours,
      guestCount: input.guestCount,
      budgetInr: input.budgetInr,
      studioPreference: input.studioPreference,
      aiDetectedIntent: input.aiDetectedIntent,
      conversationSummary: input.conversationSummary,
      stage: input.stage,
      campaignId: input.campaignId,
    });
    await writeAudit({ actorId: authResult.auth.user.id, action: "lead.create", entityType: "Lead", entityId: lead.id, after: lead });
    return jsonData(lead, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
