import { z } from "zod";
import type { NextRequest } from "next/server";
import { BookingStatus } from "@prisma/client";
import { requireApiUser } from "@/lib/auth/api";
import { writeAudit } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { jsonData, parseJsonBody, routeError, type RouteContext } from "@/lib/api/route-helpers";

const statusSchema = z.object({ status: z.nativeEnum(BookingStatus) });

export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await requireApiUser(request, "bookings:manage");
  if ("error" in authResult) return authResult.error;
  const { id } = await context.params;
  try {
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id },
      include: {
        customer: true,
        studio: true,
        lead: true,
        payments: { orderBy: { createdAt: "desc" } },
        guests: true,
        cleaningTasks: true,
        tickets: true,
      },
    });
    return jsonData(booking);
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authResult = await requireApiUser(request, "bookings:manage");
  if ("error" in authResult) return authResult.error;
  const { id } = await context.params;
  try {
    const input = await parseJsonBody(request, statusSchema);
    const before = await prisma.booking.findUniqueOrThrow({ where: { id } });
    const booking = await prisma.booking.update({ where: { id }, data: { status: input.status } });
    await writeAudit({ actorId: authResult.auth.user.id, action: "booking.status", entityType: "Booking", entityId: id, before, after: booking });
    return jsonData(booking);
  } catch (error) {
    return routeError(error);
  }
}
