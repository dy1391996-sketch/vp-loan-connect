import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { writeAudit } from "@/lib/auth/session";
import { createTemporaryHold, releaseTemporaryHold } from "@/lib/domain/holds";
import { jsonData, parseJsonBody, routeError } from "@/lib/api/route-helpers";

const createSchema = z.object({
  studioId: z.string().min(1),
  checkInAt: z.string().datetime(),
  durationHours: z.number().positive(),
  customerId: z.string().optional(),
  leadId: z.string().optional(),
  idempotencyKey: z.string().optional(),
  holdMinutes: z.number().int().positive().optional(),
});

const deleteSchema = z.object({ holdId: z.string().min(1) });

export async function POST(request: NextRequest) {
  const authResult = await requireApiUser(request, "bookings:manage");
  if ("error" in authResult) return authResult.error;
  try {
    const input = await parseJsonBody(request, createSchema);
    const hold = await createTemporaryHold({
      ...input,
      checkInAt: new Date(input.checkInAt),
      createdById: authResult.auth.user.id,
    });
    await writeAudit({ actorId: authResult.auth.user.id, action: "hold.create", entityType: "TemporaryHold", entityId: hold.id, after: hold });
    return jsonData(hold, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await requireApiUser(request, "bookings:manage");
  if ("error" in authResult) return authResult.error;
  try {
    const input = await parseJsonBody(request, deleteSchema);
    const hold = await releaseTemporaryHold(input.holdId);
    await writeAudit({ actorId: authResult.auth.user.id, action: "hold.release", entityType: "TemporaryHold", entityId: hold.id, after: hold });
    return jsonData(hold);
  } catch (error) {
    return routeError(error);
  }
}
