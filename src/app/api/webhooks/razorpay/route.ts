import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPublicAppUrl, getServerEnv } from "@/lib/env";
import { processSuccessfulPayment } from "@/lib/payments/order-service";
import { verifyRazorpayWebhookSignature } from "@/lib/payments/razorpay";
import { sendWhatsAppTemplate } from "@/lib/providers/whatsapp";
import { signAccessToken } from "@/lib/security/tokens";
import { sha256 } from "@/lib/utils";

type RazorpayEvent = {
  event: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        error_code?: string;
        error_description?: string;
      };
    };
  };
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const env = getServerEnv();
  if (!env.RAZORPAY_WEBHOOK_SECRET || !verifyRazorpayWebhookSignature(rawBody, signature, env.RAZORPAY_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let body: RazorpayEvent;
  try {
    body = JSON.parse(rawBody) as RazorpayEvent;
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const entity = body.payload?.payment?.entity;
  const eventId = request.headers.get("x-razorpay-event-id") || `${body.event}:${entity?.id ?? sha256(rawBody)}`;
  try {
    await prisma.paymentWebhookEvent.create({ data: { providerEventId: eventId, eventType: body.event, payloadHash: sha256(rawBody) } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ duplicate: true });
    }
    throw error;
  }

  try {
    const order = entity?.order_id ? await prisma.order.findUnique({ where: { providerOrderId: entity.order_id } }) : null;
    if (body.event === "payment.captured" && entity?.id && order) {
      const processed = await processSuccessfulPayment({ orderId: order.id, providerPaymentId: entity.id, provider: "razorpay" });
      const reportToken = await signAccessToken("report_access", processed.report.id, { leadId: order.leadId, orderId: order.id }, "72h");
      const reportUrl = `${getPublicAppUrl()}/report/${processed.report.id}?token=${encodeURIComponent(reportToken)}`;
      await sendWhatsAppTemplate(order.leadId, "REPORT_READY", { link: reportUrl }).catch((error) => {
        console.error("razorpay_report_delivery_failed", error instanceof Error ? error.message : "unknown");
      });
    } else if (body.event === "payment.failed" && entity?.id && order) {
      const payment = await prisma.payment.findFirst({ where: { orderId: order.id }, orderBy: { createdAt: "desc" } });
      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            providerPaymentId: entity.id,
            status: "FAILED",
            failureCode: entity.error_code,
            failureDescription: entity.error_description,
          },
        });
      }
      await prisma.order.update({ where: { id: order.id }, data: { status: "FAILED" } });
    }

    await prisma.paymentWebhookEvent.update({ where: { providerEventId: eventId }, data: { processedAt: new Date() } });
    return NextResponse.json({ processed: true });
  } catch (error) {
    await prisma.paymentWebhookEvent.update({
      where: { providerEventId: eventId },
      data: { error: error instanceof Error ? error.message.slice(0, 500) : "unknown" },
    });
    return NextResponse.json({ error: "Processing failed." }, { status: 500 });
  }
}
