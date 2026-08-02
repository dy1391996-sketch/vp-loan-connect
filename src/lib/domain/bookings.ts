import { prisma } from "@/lib/db";
import { addHours, generateBookingReference } from "@/lib/utils";
import { assertStudioAvailable } from "@/lib/domain/availability";
import { calculateBookingPrice } from "@/lib/domain/pricing";
import { createTemporaryHold } from "@/lib/domain/holds";
import { createPaymentLink } from "@/lib/integrations/razorpay/client";
import { getServerEnv } from "@/lib/env";

export async function createBookingDraft(input: {
  customerId: string;
  leadId?: string;
  studioId: string;
  checkInAt: Date;
  durationHours: number;
  guestCount: number;
  couponCode?: string;
  priceOverrideInr?: number;
  priceOverrideReason?: string;
  createHold?: boolean;
  createdById?: string;
  idempotencyKey?: string;
}) {
  const checkOutAt = addHours(input.checkInAt, input.durationHours);
  await assertStudioAvailable(input.studioId, input.checkInAt, checkOutAt);

  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: input.customerId } });
  const quote = await calculateBookingPrice({
    checkInAt: input.checkInAt,
    durationHours: input.durationHours,
    studioId: input.studioId,
    couponCode: input.couponCode,
    returningCustomer: customer.returningCustomer,
    manualOverrideInr: input.priceOverrideInr,
  });

  let holdId: string | undefined;
  if (input.createHold !== false) {
    const hold = await createTemporaryHold({
      studioId: input.studioId,
      checkInAt: input.checkInAt,
      durationHours: input.durationHours,
      customerId: input.customerId,
      leadId: input.leadId,
      idempotencyKey: input.idempotencyKey ? `hold:${input.idempotencyKey}` : undefined,
      createdById: input.createdById,
    });
    holdId = hold.id;
  }

  const booking = await prisma.booking.create({
    data: {
      reference: generateBookingReference(),
      customerId: input.customerId,
      leadId: input.leadId,
      studioId: input.studioId,
      holdId,
      status: holdId ? "HOLD" : "DRAFT",
      checkInAt: input.checkInAt,
      checkOutAt,
      durationHours: input.durationHours,
      guestCount: input.guestCount,
      baseAmountInr: quote.baseAmountInr,
      discountInr: quote.discountInr,
      tokenAmountInr: quote.tokenAmountInr,
      totalAmountInr: quote.totalAmountInr,
      couponCode: input.couponCode,
      priceOverrideInr: input.priceOverrideInr,
      priceOverrideReason: input.priceOverrideReason,
      createdById: input.createdById,
    },
    include: { studio: true, customer: true },
  });

  if (holdId) {
    await prisma.availabilityBlock.updateMany({
      where: { holdId },
      data: { bookingId: booking.id },
    });
  }

  if (input.leadId) {
    await prisma.lead.update({
      where: { id: input.leadId },
      data: {
        stage: "TOKEN_PENDING",
        bookingValueInr: quote.totalAmountInr,
        lastContactAt: new Date(),
      },
    });
  }

  return { booking, quote };
}

export async function generateBookingPaymentLink(bookingId: string, createdById?: string) {
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { customer: true, studio: true },
  });
  if (!["HOLD", "TOKEN_PENDING", "DRAFT"].includes(booking.status)) {
    throw new Error("Payment link can only be generated for draft/hold bookings.");
  }

  const env = getServerEnv();
  const amountInr = booking.tokenAmountInr;
  const idempotencyKey = `token:${booking.id}`;

  const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });
  if (existing?.paymentLinkUrl && existing.status !== "FAILED" && existing.status !== "CANCELLED") {
    return existing;
  }

  const provider = await createPaymentLink({
    amountInr,
    description: `Token for ${booking.reference} · ${booking.studio.title}`,
    customer: {
      name: booking.customer.name ?? "Guest",
      contact: booking.customer.phone ?? undefined,
      email: booking.customer.email ?? undefined,
    },
    notes: {
      bookingId: booking.id,
      bookingReference: booking.reference,
      kind: "TOKEN",
    },
    callbackUrl: `${env.NEXT_PUBLIC_APP_URL}/bookings?payment=return`,
  });

  const payment = await prisma.payment.upsert({
    where: { idempotencyKey },
    create: {
      bookingId: booking.id,
      customerId: booking.customerId,
      kind: "TOKEN",
      status: "PENDING",
      amountInr,
      provider: provider.provider,
      providerOrderId: provider.orderId,
      paymentLinkUrl: provider.shortUrl,
      paymentLinkId: provider.paymentLinkId,
      idempotencyKey,
      createdById,
      metadata: provider.raw as object | undefined,
    },
    update: {
      status: "PENDING",
      providerOrderId: provider.orderId,
      paymentLinkUrl: provider.shortUrl,
      paymentLinkId: provider.paymentLinkId,
      metadata: provider.raw as object | undefined,
    },
  });

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "TOKEN_PENDING" },
  });
  await prisma.studio.update({
    where: { id: booking.studioId },
    data: { availabilityStatus: "TOKEN_PENDING" },
  });

  return payment;
}

export async function confirmBookingFromPayment(input: {
  bookingId: string;
  providerPaymentId: string;
  providerOrderId?: string;
  amountInr: number;
}) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: input.bookingId },
      include: { hold: true },
    });

    if (booking.status === "CONFIRMED" || booking.status === "CHECKED_IN") {
      return booking;
    }

    const payment = await tx.payment.findFirst({
      where: {
        bookingId: booking.id,
        kind: "TOKEN",
        OR: [{ providerPaymentId: input.providerPaymentId }, { providerOrderId: input.providerOrderId ?? undefined }],
      },
    });

    if (payment) {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "PAID",
          providerPaymentId: input.providerPaymentId,
          paidAt: new Date(),
        },
      });
    }

    if (booking.holdId) {
      await tx.temporaryHold.update({
        where: { id: booking.holdId },
        data: { status: "CONVERTED" },
      });
    }

    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: { status: "CONFIRMED" },
    });

    await tx.studio.update({
      where: { id: booking.studioId },
      data: { availabilityStatus: "CONFIRMED_BOOKING" },
    });

    if (booking.leadId) {
      await tx.lead.update({
        where: { id: booking.leadId },
        data: { stage: "CONFIRMED", bookingProbability: 100 },
      });
    }

    await tx.availabilityBlock.updateMany({
      where: { bookingId: booking.id },
      data: { reason: "confirmed_booking" },
    });

    return updated;
  });
}
