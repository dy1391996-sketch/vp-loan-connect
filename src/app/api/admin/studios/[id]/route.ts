import { z } from "zod";
import type { NextRequest } from "next/server";
import { AvailabilityStatus, CleaningStatus, StudioCategory, StudioCondition } from "@prisma/client";
import { requireApiUser } from "@/lib/auth/api";
import { writeAudit } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { jsonData, parseJsonBody, routeError, type RouteContext } from "@/lib/api/route-helpers";

const updateStudioSchema = z.object({
  number: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  property: z.string().min(1).optional(),
  building: z.string().nullable().optional(),
  floor: z.number().int().nullable().optional(),
  category: z.nativeEnum(StudioCategory).optional(),
  isPremium: z.boolean().optional(),
  hasBalcony: z.boolean().optional(),
  hasJacuzzi: z.boolean().optional(),
  viewType: z.string().nullable().optional(),
  maxGuests: z.number().int().positive().optional(),
  condition: z.nativeEnum(StudioCondition).optional(),
  cleaningStatus: z.nativeEnum(CleaningStatus).optional(),
  availabilityStatus: z.nativeEnum(AvailabilityStatus).optional(),
  amenities: z.array(z.string()).optional(),
  weekdayPriceInr: z.number().int().nonnegative().nullable().optional(),
  weekendPriceInr: z.number().int().nonnegative().nullable().optional(),
  hourlyPriceInr: z.number().int().nonnegative().nullable().optional(),
  securityDepositInr: z.number().int().nonnegative().nullable().optional(),
  publicDescription: z.string().nullable().optional(),
  internalNotes: z.string().nullable().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await requireApiUser(request, "studios:manage");
  if ("error" in authResult) return authResult.error;
  const { id } = await context.params;
  try {
    const studio = await prisma.studio.findUniqueOrThrow({
      where: { id },
      include: {
        media: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }] },
        bookings: { include: { customer: true }, orderBy: { checkInAt: "desc" }, take: 10 },
        maintenanceTasks: { orderBy: { createdAt: "desc" }, take: 10 },
        cleaningTasks: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
    return jsonData(studio);
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authResult = await requireApiUser(request, "studios:manage");
  if ("error" in authResult) return authResult.error;
  const { id } = await context.params;
  try {
    const input = await parseJsonBody(request, updateStudioSchema);
    const before = await prisma.studio.findUniqueOrThrow({ where: { id } });
    const studio = await prisma.studio.update({ where: { id }, data: input });
    await writeAudit({ actorId: authResult.auth.user.id, action: "studio.update", entityType: "Studio", entityId: id, before, after: studio });
    return jsonData(studio);
  } catch (error) {
    return routeError(error);
  }
}
