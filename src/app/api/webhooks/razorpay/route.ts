import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { confirmBookingFromPayment } from "@/lib/domain/bookings";
import { prisma } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { verifyRazorpayWebhookSignature } from "@/lib/security/signatures";
import { routeError } from "@/lib/api/route-helpers";
import { sha256 } from "@/lib/utils";

const paymentEntitySchema = z.object({
  id: z.string().optional(),
  order_id: z.string().optional(),
  amount: z.number().optional(),
  notes: z.record(z.unknown()).optional(),
});

const razorpayWebhookSchema = z.object({
  event: z.string(),
  payload: z
    .object({
      payment: z.object({ entity: paymentEntitySchema }).optional(),
      order: z.object({ entity: z.record(z.unknown()) }).optional(),
      payment_link: z.object({ entity: z.record(z.unknown()) }).optional(),
    })
    .passthrough()
    .optional(),
}).passthrough();

function bookingIdFromPayment(entity: z.infer<typeof paymentEntitySchema>) {
  const notes = entity.notes ?? {};
  return typeof notes.bookingId === "string" ? notes.bookingId : undefined;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const env = getServerEnv();
    const signature = request.headers.get("x-razorpay-signature") ?? "";
    const hasSecret = Boolean(env.RAZORPAY_WEBHOOK_SECRET);
    const sandboxAllowed = env.NODE_ENV !== "production" || env.PAYMENT_PROVIDER === "mock";
    if (hasSecret && !verifyRazorpayWebhookSignature(rawBody, signature, env.RAZORPAY_WEBHOOK_SECRET)) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }
    if (!hasSecret && !sandboxAllowed) {
      return NextResponse.json({ error: "Razorpay webhook secret is not configured." }, { status: 401 });
    }

    const payload = razorpayWebhookSchema.parse(JSON.parse(rawBody));
    const payment = payload.payload?.payment?.entity;
    const idempotencyKey = `razorpay:${payload.event}:${payment?.id ?? sha256(rawBody)}`;
    const existing = await prisma.webhookEvent.findUnique({ where: { idempotencyKey } });
    if (existing) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const event = await prisma.webhookEvent.create({
      data: {
        provider: "RAZORPAY",
        eventType: payload.event,
        idempotencyKey,
        payload: payload as object,
      },
    });

    let confirmedBookingId: string | null = null;
    if (payment && ["payment.captured", "payment.authorized", "order.paid"].includes(payload.event)) {
      const bookingId = bookingIdFromPayment(payment);
      if (bookingId && payment.id) {
        const booking = await confirmBookingFromPayment({
          bookingId,
          providerPaymentId: payment.id,
          providerOrderId: payment.order_id,
          amountInr: payment.amount ? Math.round(payment.amount / 100) : 0,
        });
        confirmedBookingId = booking.id;
      }
    }

    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { status: "PROCESSED", processedAt: new Date() },
    });

    return NextResponse.json({ ok: true, id: event.id, confirmedBookingId });
  } catch (error) {
    return routeError(error);
  }
}
