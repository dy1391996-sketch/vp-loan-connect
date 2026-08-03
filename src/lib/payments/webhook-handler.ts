import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPublicAppUrl, getServerEnv } from "@/lib/env";
import { getPaymentProvider, type PaymentProviderId } from "@/lib/payments";
import { processSuccessfulPayment } from "@/lib/payments/order-service";
import { sendWhatsAppTemplate } from "@/lib/providers/whatsapp";
import { signAccessToken } from "@/lib/security/tokens";
import { sha256 } from "@/lib/utils";

export async function handlePaymentWebhook(providerId: PaymentProviderId, request: NextRequest) {
  const rawBody = await request.text();
  const env = getServerEnv();
  const provider = getPaymentProvider(providerId);

  if (!provider.verifyWebhookSignature(rawBody, request.headers, env)) {
    console.warn("payment_webhook_invalid_signature", { provider: providerId });
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const parsed = provider.parseWebhook(rawBody, request.headers, env);
  if (parsed.kind === "ignored") {
    return NextResponse.json({ ignored: true, reason: parsed.reason });
  }

  const eventKey = `${providerId}:${parsed.providerEventId}`;
  let existing = await prisma.paymentWebhookEvent.findUnique({ where: { providerEventId: eventKey } });
  if (existing?.processedAt) {
    return NextResponse.json({ duplicate: true });
  }

  if (!existing) {
    try {
      existing = await prisma.paymentWebhookEvent.create({
        data: {
          providerEventId: eventKey,
          eventType: parsed.kind,
          payloadHash: sha256(rawBody),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        existing = await prisma.paymentWebhookEvent.findUnique({ where: { providerEventId: eventKey } });
        if (existing?.processedAt) return NextResponse.json({ duplicate: true });
      } else {
        throw error;
      }
    }
  }

  try {
    const order = await prisma.order.findUnique({
      where: { providerOrderId: parsed.providerOrderId },
      include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    // Prefer the recorded payment provider if present (supports gateway switches without breaking history).
    const recordedProvider = order?.payments[0]?.provider as PaymentProviderId | undefined;
    const unlockProvider = recordedProvider && recordedProvider === providerId ? recordedProvider : providerId;

    if (parsed.kind === "payment_captured" && order) {
      const processed = await processSuccessfulPayment({
        orderId: order.id,
        providerPaymentId: parsed.providerPaymentId,
        provider: unlockProvider,
      });
      const reportToken = await signAccessToken("report_access", processed.report.id, { leadId: order.leadId, orderId: order.id }, "72h");
      const reportUrl = `${getPublicAppUrl()}/report/${processed.report.id}?token=${encodeURIComponent(reportToken)}`;
      await Promise.all([
        sendWhatsAppTemplate(order.leadId, "PAYMENT_SUCCESS", { reference: order.orderReference }),
        sendWhatsAppTemplate(order.leadId, "REPORT_READY", { link: reportUrl }),
      ]).catch((error) => {
        console.error("payment_report_delivery_failed", error instanceof Error ? error.message : "unknown");
      });
    } else if (parsed.kind === "payment_failed" && order) {
      const payment = await prisma.payment.findFirst({ where: { orderId: order.id }, orderBy: { createdAt: "desc" } });
      if (payment && payment.status !== "CAPTURED" && payment.status !== "REFUNDED" && payment.status !== "PARTIALLY_REFUNDED") {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            providerPaymentId: parsed.providerPaymentId,
            status: "FAILED",
            failureCode: parsed.failureCode,
            failureDescription: parsed.failureDescription,
          },
        });
      }
      if (order.status !== "PAID" && order.status !== "REFUNDED" && order.status !== "PARTIALLY_REFUNDED") {
        await prisma.order.update({ where: { id: order.id }, data: { status: "FAILED" } });
      }
    }

    await prisma.paymentWebhookEvent.update({
      where: { providerEventId: eventKey },
      data: { processedAt: new Date(), error: null },
    });
    return NextResponse.json({ processed: true });
  } catch (error) {
    await prisma.paymentWebhookEvent.update({
      where: { providerEventId: eventKey },
      data: { error: error instanceof Error ? error.message.slice(0, 500) : "unknown" },
    });
    console.error("payment_webhook_failed", { provider: providerId, message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "Processing failed." }, { status: 500 });
  }
}
