import { z } from "zod";
import { CleaningStatus, StudioCategory, StudioCondition, AvailabilityStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { writeAudit } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { jsonData, parseJsonBody, routeError } from "@/lib/api/route-helpers";

const studioSchema = z.object({
  number: z.string().min(1),
  title: z.string().min(1),
  property: z.string().min(1).default("Gaur City Center"),
  building: z.string().optional(),
  floor: z.number().int().optional(),
  category: z.nativeEnum(StudioCategory).default("STANDARD"),
  isPremium: z.boolean().default(false),
  hasBalcony: z.boolean().default(false),
  hasJacuzzi: z.boolean().default(false),
  viewType: z.string().optional(),
  maxGuests: z.number().int().positive().default(2),
  condition: z.nativeEnum(StudioCondition).default("GOOD"),
  cleaningStatus: z.nativeEnum(CleaningStatus).default("READY"),
  availabilityStatus: z.nativeEnum(AvailabilityStatus).default("AVAILABLE"),
  amenities: z.array(z.string()).default([]),
  weekdayPriceInr: z.number().int().nonnegative().optional(),
  weekendPriceInr: z.number().int().nonnegative().optional(),
  hourlyPriceInr: z.number().int().nonnegative().optional(),
  securityDepositInr: z.number().int().nonnegative().optional(),
  publicDescription: z.string().optional(),
  internalNotes: z.string().optional(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export async function GET(request: NextRequest) {
  const authResult = await requireApiUser(request, "studios:manage");
  if ("error" in authResult) return authResult.error;

  const studios = await prisma.studio.findMany({
    include: { media: { take: 1, orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }] }, _count: { select: { bookings: true, maintenanceTasks: true } } },
    orderBy: [{ sortOrder: "asc" }, { number: "asc" }],
  });
  return jsonData(studios);
}

export async function POST(request: NextRequest) {
  const authResult = await requireApiUser(request, "studios:manage");
  if ("error" in authResult) return authResult.error;
  try {
    const input = await parseJsonBody(request, studioSchema);
    const studio = await prisma.studio.create({ data: { ...input, createdById: authResult.auth.user.id } });
    await writeAudit({ actorId: authResult.auth.user.id, action: "studio.create", entityType: "Studio", entityId: studio.id, after: studio });
    return jsonData(studio, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
