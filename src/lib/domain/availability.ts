import { prisma } from "@/lib/db";
import { addHours, rangesOverlap } from "@/lib/utils";
import { calculateBookingPrice } from "@/lib/domain/pricing";

export type AvailabilitySearchInput = {
  checkInAt: Date;
  durationHours: number;
  guestCount: number;
  preferBalcony?: boolean;
  preferJacuzzi?: boolean;
  preferPremium?: boolean;
  studioIds?: string[];
};

export async function searchAvailableStudios(input: AvailabilitySearchInput) {
  if (input.durationHours <= 0) throw new Error("Duration must be positive.");
  if (input.guestCount <= 0) throw new Error("Guest count must be positive.");

  const checkOutAt = addHours(input.checkInAt, input.durationHours);
  const now = new Date();

  // Expire stale holds first (best-effort)
  await prisma.temporaryHold.updateMany({
    where: { status: "ACTIVE", expiresAt: { lte: now } },
    data: { status: "EXPIRED" },
  });

  const studios = await prisma.studio.findMany({
    where: {
      active: true,
      maxGuests: { gte: input.guestCount },
      availabilityStatus: { notIn: ["MAINTENANCE_BLOCKED"] },
      ...(input.preferBalcony ? { hasBalcony: true } : {}),
      ...(input.preferJacuzzi ? { hasJacuzzi: true } : {}),
      ...(input.preferPremium ? { isPremium: true } : {}),
      ...(input.studioIds?.length ? { id: { in: input.studioIds } } : {}),
    },
    include: {
      media: { where: { approved: true, isCurrent: true }, orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 3 },
      availabilityBlocks: {
        where: {
          startsAt: { lt: checkOutAt },
          endsAt: { gt: input.checkInAt },
        },
      },
      holds: {
        where: {
          status: "ACTIVE",
          expiresAt: { gt: now },
          startsAt: { lt: checkOutAt },
          endsAt: { gt: input.checkInAt },
        },
      },
      bookings: {
        where: {
          status: { in: ["HOLD", "TOKEN_PENDING", "CONFIRMED", "CHECKED_IN"] },
          checkInAt: { lt: checkOutAt },
          checkOutAt: { gt: input.checkInAt },
        },
        select: { id: true },
      },
      maintenanceTasks: {
        where: { status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] }, blocksStudio: true },
        select: { id: true },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { number: "asc" }],
  });

  const available = [];
  for (const studio of studios) {
    if (studio.availabilityBlocks.length > 0) continue;
    if (studio.holds.length > 0) continue;
    if (studio.bookings.length > 0) continue;
    if (studio.maintenanceTasks.length > 0) continue;
    if (["CLEANING_IN_PROGRESS", "CHECKOUT_PENDING", "OCCUPIED", "CONFIRMED_BOOKING", "TOKEN_PENDING", "TENTATIVELY_BLOCKED"].includes(studio.availabilityStatus)) {
      // Still allow if no overlapping blocks — status can lag; blocks/bookings are source of truth for period
      // But hard-block maintenance already handled. Soft statuses without blocks: skip occupied-like only if currently overlapping "now"
      if (studio.availabilityStatus === "MAINTENANCE_BLOCKED") continue;
    }

    // Cleaning readiness: if checkout cleaning incomplete and next booking would start soon, exclude when status says cleaning
    if (studio.cleaningStatus === "DIRTY" || studio.cleaningStatus === "IN_PROGRESS") {
      // Allow listing but mark notReady — AI must not promise ready check-in
    }

    const quote = await calculateBookingPrice({
      checkInAt: input.checkInAt,
      durationHours: input.durationHours,
      studioId: studio.id,
      studio,
    });

    available.push({
      id: studio.id,
      number: studio.number,
      title: studio.title,
      category: studio.category,
      isPremium: studio.isPremium,
      hasBalcony: studio.hasBalcony,
      hasJacuzzi: studio.hasJacuzzi,
      viewType: studio.viewType,
      maxGuests: studio.maxGuests,
      amenities: studio.amenities,
      cleaningStatus: studio.cleaningStatus,
      ready: studio.cleaningStatus === "READY" || studio.cleaningStatus === "CLEAN",
      coverImage: studio.media.find((m) => m.isCover)?.url ?? studio.media[0]?.url ?? null,
      media: studio.media,
      checkInAt: input.checkInAt,
      checkOutAt,
      durationHours: input.durationHours,
      price: quote,
    });
  }

  return available.slice(0, 20);
}

export async function assertStudioAvailable(studioId: string, checkInAt: Date, checkOutAt: Date, excludeHoldId?: string) {
  const now = new Date();
  const studio = await prisma.studio.findUnique({ where: { id: studioId } });
  if (!studio || !studio.active) throw new Error("Studio not found or inactive.");
  if (studio.availabilityStatus === "MAINTENANCE_BLOCKED") throw new Error("Studio is under maintenance.");

  const [blocks, holds, bookings, maintenance] = await Promise.all([
    prisma.availabilityBlock.findMany({
      where: { studioId, startsAt: { lt: checkOutAt }, endsAt: { gt: checkInAt } },
    }),
    prisma.temporaryHold.findMany({
      where: {
        studioId,
        status: "ACTIVE",
        expiresAt: { gt: now },
        startsAt: { lt: checkOutAt },
        endsAt: { gt: checkInAt },
        ...(excludeHoldId ? { id: { not: excludeHoldId } } : {}),
      },
    }),
    prisma.booking.findMany({
      where: {
        studioId,
        status: { in: ["HOLD", "TOKEN_PENDING", "CONFIRMED", "CHECKED_IN"] },
        checkInAt: { lt: checkOutAt },
        checkOutAt: { gt: checkInAt },
      },
    }),
    prisma.maintenanceTask.findFirst({
      where: { studioId, blocksStudio: true, status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] } },
    }),
  ]);

  if (maintenance) throw new Error("Studio is blocked for maintenance.");
  if (blocks.length || holds.length || bookings.length) throw new Error("Studio is not available for the selected period.");

  // Defensive overlap check
  for (const b of blocks) {
    if (rangesOverlap(checkInAt, checkOutAt, b.startsAt, b.endsAt)) throw new Error("Studio is not available for the selected period.");
  }

  return studio;
}
