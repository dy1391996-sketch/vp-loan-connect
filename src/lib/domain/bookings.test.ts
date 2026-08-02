import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { PrismaClient } from "@prisma/client";
import { createTemporaryHold, releaseTemporaryHold } from "@/lib/domain/holds";
import { createBookingDraft, confirmBookingFromPayment } from "@/lib/domain/bookings";
import { addHours } from "@/lib/utils";

const prisma = new PrismaClient();

describe("holds and bookings integration", () => {
  let studioId = "";
  let customerId = "";

  before(async () => {
    process.env.PAYMENT_PROVIDER = "mock";
    process.env.HOLD_MINUTES = "15";
    process.env.TOKEN_PERCENT = "30";
    const studio = await prisma.studio.findFirst({ where: { active: true } });
    const customer = await prisma.customer.findFirst();
    if (!studio || !customer) {
      throw new Error("Seed data required: run pnpm db:seed before integration tests");
    }
    studioId = studio.id;
    customerId = customer.id;
  });

  after(async () => {
    await prisma.$disconnect();
  });

  it("creates a hold and blocks a second overlapping hold", async () => {
    const checkInAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    checkInAt.setMinutes(0, 0, 0);
    const hold = await createTemporaryHold({
      studioId,
      checkInAt,
      durationHours: 24,
      customerId,
      idempotencyKey: `test-hold-${Date.now()}`,
    });
    assert.equal(hold.status, "ACTIVE");

    await assert.rejects(
      () =>
        createTemporaryHold({
          studioId,
          checkInAt,
          durationHours: 24,
          customerId,
          idempotencyKey: `test-hold-conflict-${Date.now()}`,
        }),
      /hold|available|booked/i,
    );

    await releaseTemporaryHold(hold.id);
  });

  it("confirms booking only after payment verification path", async () => {
    const checkInAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    checkInAt.setMinutes(0, 0, 0);
    const { booking } = await createBookingDraft({
      customerId,
      studioId,
      checkInAt,
      durationHours: 24,
      guestCount: 2,
      idempotencyKey: `test-booking-${Date.now()}`,
    });
    assert.ok(["HOLD", "DRAFT"].includes(booking.status));

    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        customerId,
        kind: "TOKEN",
        status: "PAID",
        amountInr: booking.tokenAmountInr,
        provider: "mock",
        providerPaymentId: `pay_test_${booking.id}`,
        providerOrderId: `order_test_${booking.id}`,
        paidAt: new Date(),
        idempotencyKey: `token-test:${booking.id}`,
      },
    });

    const confirmed = await confirmBookingFromPayment({
      bookingId: booking.id,
      providerPaymentId: `pay_test_${booking.id}`,
      providerOrderId: `order_test_${booking.id}`,
      amountInr: booking.tokenAmountInr,
    });
    assert.equal(confirmed.status, "CONFIRMED");
    assert.equal(addHours(checkInAt, 24).toISOString(), booking.checkOutAt.toISOString());
  });

  it("webhook idempotency rejects duplicate event keys", async () => {
    const key = `idem-${Date.now()}`;
    await prisma.webhookEvent.create({
      data: {
        provider: "RAZORPAY",
        eventType: "payment.captured",
        idempotencyKey: key,
        payload: { ok: true },
        status: "PROCESSED",
        processedAt: new Date(),
      },
    });
    await assert.rejects(
      () =>
        prisma.webhookEvent.create({
          data: {
            provider: "RAZORPAY",
            eventType: "payment.captured",
            idempotencyKey: key,
            payload: { ok: true },
            status: "RECEIVED",
          },
        }),
    );
  });
});
