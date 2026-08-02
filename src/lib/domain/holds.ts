import { prisma } from "@/lib/db";
import { addHours, addMinutes } from "@/lib/utils";
import { assertStudioAvailable } from "@/lib/domain/availability";
import { getServerEnv } from "@/lib/env";

export async function createTemporaryHold(input: {
  studioId: string;
  checkInAt: Date;
  durationHours: number;
  customerId?: string;
  leadId?: string;
  idempotencyKey?: string;
  holdMinutes?: number;
  createdById?: string;
}) {
  if (input.idempotencyKey) {
    const existing = await prisma.temporaryHold.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return existing;
  }

  const checkOutAt = addHours(input.checkInAt, input.durationHours);
  await assertStudioAvailable(input.studioId, input.checkInAt, checkOutAt);

  const holdMinutes = input.holdMinutes ?? getServerEnv().HOLD_MINUTES;
  const expiresAt = addMinutes(new Date(), holdMinutes);

  return prisma.$transaction(async (tx) => {
    // Re-check inside transaction
    const conflict = await tx.booking.findFirst({
      where: {
        studioId: input.studioId,
        status: { in: ["HOLD", "TOKEN_PENDING", "CONFIRMED", "CHECKED_IN"] },
        checkInAt: { lt: checkOutAt },
        checkOutAt: { gt: input.checkInAt },
      },
    });
    if (conflict) throw new Error("Studio was just booked by another customer.");

    const activeHold = await tx.temporaryHold.findFirst({
      where: {
        studioId: input.studioId,
        status: "ACTIVE",
        expiresAt: { gt: new Date() },
        startsAt: { lt: checkOutAt },
        endsAt: { gt: input.checkInAt },
      },
    });
    if (activeHold) throw new Error("Studio has an active temporary hold.");

    const hold = await tx.temporaryHold.create({
      data: {
        studioId: input.studioId,
        customerId: input.customerId,
        leadId: input.leadId,
        startsAt: input.checkInAt,
        endsAt: checkOutAt,
        expiresAt,
        status: "ACTIVE",
        idempotencyKey: input.idempotencyKey,
        createdById: input.createdById,
      },
    });

    await tx.availabilityBlock.create({
      data: {
        studioId: input.studioId,
        startsAt: input.checkInAt,
        endsAt: checkOutAt,
        reason: "temporary_hold",
        holdId: hold.id,
        createdById: input.createdById,
      },
    });

    await tx.studio.update({
      where: { id: input.studioId },
      data: { availabilityStatus: "TENTATIVELY_BLOCKED" },
    });

    return hold;
  });
}

export async function releaseTemporaryHold(holdId: string, reason = "released") {
  return prisma.$transaction(async (tx) => {
    const hold = await tx.temporaryHold.findUnique({ where: { id: holdId } });
    if (!hold) throw new Error("Hold not found.");
    if (hold.status !== "ACTIVE") return hold;

    await tx.temporaryHold.update({
      where: { id: holdId },
      data: { status: reason === "expired" ? "EXPIRED" : "RELEASED" },
    });
    await tx.availabilityBlock.deleteMany({ where: { holdId } });

    const studio = await tx.studio.findUnique({ where: { id: hold.studioId } });
    if (studio && studio.availabilityStatus === "TENTATIVELY_BLOCKED") {
      await tx.studio.update({
        where: { id: hold.studioId },
        data: { availabilityStatus: "AVAILABLE" },
      });
    }
    return hold;
  });
}

export async function expireDueHolds() {
  const due = await prisma.temporaryHold.findMany({
    where: { status: "ACTIVE", expiresAt: { lte: new Date() } },
  });
  for (const hold of due) {
    await releaseTemporaryHold(hold.id, "expired");
  }
  return due.length;
}
