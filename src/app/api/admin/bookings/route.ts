import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { writeAudit } from "@/lib/auth/session";
import { createBookingDraft } from "@/lib/domain/bookings";
import { prisma } from "@/lib/db";
import { jsonData, parseJsonBody, routeError, searchParams } from "@/lib/api/route-helpers";

const bookingCreateSchema = z.object({
  customerId: z.string().min(1),
  leadId: z.string().optional(),
  studioId: z.string().min(1),
  checkInAt: z.string().datetime(),
  durationHours: z.number().positive(),
  guestCount: z.number().int().positive().default(2),
  couponCode: z.string().optional(),
  priceOverrideInr: z.number().int().nonnegative().optional(),
  priceOverrideReason: z.string().optional(),
  createHold: z.boolean().optional(),
  idempotencyKey: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const authResult = await requireApiUser(request, "bookings:manage");
  if ("error" in authResult) return authResult.error;
  const status = searchParams(request).get("status");
  const bookings = await prisma.booking.findMany({
    where: status ? { status: status as never } : undefined,
    include: { customer: true, studio: true, payments: { orderBy: { createdAt: "desc" }, take: 3 } },
    orderBy: { checkInAt: "desc" },
    take: 100,
  });
  return jsonData(bookings);
}

export async function POST(request: NextRequest) {
  const authResult = await requireApiUser(request, "bookings:manage");
  if ("error" in authResult) return authResult.error;
  try {
    const input = await parseJsonBody(request, bookingCreateSchema);
    const result = await createBookingDraft({
      ...input,
      checkInAt: new Date(input.checkInAt),
      createdById: authResult.auth.user.id,
    });
    await writeAudit({
      actorId: authResult.auth.user.id,
      action: "booking.createDraft",
      entityType: "Booking",
      entityId: result.booking.id,
      after: result.booking,
    });
    return jsonData(result, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
