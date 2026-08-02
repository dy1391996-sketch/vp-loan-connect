import { z } from "zod";
import type { NextRequest } from "next/server";
import { LeadStage, LeadTemperature } from "@prisma/client";
import { requireApiUser } from "@/lib/auth/api";
import { writeAudit } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { jsonData, parseJsonBody, routeError, type RouteContext } from "@/lib/api/route-helpers";

const leadUpdateSchema = z.object({
  stage: z.nativeEnum(LeadStage).optional(),
  temperature: z.nativeEnum(LeadTemperature).optional(),
  bookingProbability: z.number().int().min(0).max(100).optional(),
  requiredDate: z.string().datetime().nullable().optional(),
  checkInTime: z.string().nullable().optional(),
  durationHours: z.number().int().positive().nullable().optional(),
  guestCount: z.number().int().positive().nullable().optional(),
  budgetInr: z.number().int().nonnegative().nullable().optional(),
  studioPreference: z.string().nullable().optional(),
  followUpAt: z.string().datetime().nullable().optional(),
  conversationSummary: z.string().nullable().optional(),
  lostReason: z.string().nullable().optional(),
  assignedStaffId: z.string().nullable().optional(),
});

export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await requireApiUser(request, "leads:manage");
  if ("error" in authResult) return authResult.error;
  const { id } = await context.params;
  try {
    const lead = await prisma.lead.findUniqueOrThrow({
      where: { id },
      include: {
        customer: true,
        assignedStaff: { select: { id: true, name: true, email: true } },
        activities: { orderBy: { createdAt: "desc" }, take: 25 },
        bookings: { include: { studio: true, payments: true }, orderBy: { createdAt: "desc" } },
        followUps: { orderBy: { scheduledAt: "desc" } },
      },
    });
    return jsonData(lead);
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authResult = await requireApiUser(request, "leads:manage");
  if ("error" in authResult) return authResult.error;
  const { id } = await context.params;
  try {
    const input = await parseJsonBody(request, leadUpdateSchema);
    const before = await prisma.lead.findUniqueOrThrow({ where: { id } });
    const lead = await prisma.lead.update({
      where: { id },
      data: {
        ...input,
        requiredDate: input.requiredDate ? new Date(input.requiredDate) : input.requiredDate,
        followUpAt: input.followUpAt ? new Date(input.followUpAt) : input.followUpAt,
        lastContactAt: new Date(),
      },
    });
    await writeAudit({ actorId: authResult.auth.user.id, action: "lead.update", entityType: "Lead", entityId: id, before, after: lead });
    return jsonData(lead);
  } catch (error) {
    return routeError(error);
  }
}
