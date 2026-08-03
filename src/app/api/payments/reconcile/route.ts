import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getPublicAppUrl, getServerEnv } from "@/lib/env";
import { getPaymentProvider, type PaymentProviderId } from "@/lib/payments";
import { processSuccessfulPayment } from "@/lib/payments/order-service";
import { sendWhatsAppTemplate } from "@/lib/providers/whatsapp";
import { assertSameOrigin, rateLimit, requestIpHash } from "@/lib/security/request";
import { signAccessToken, verifyAccessToken } from "@/lib/security/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Authenticated recovery when redirect/webhook race leaves an order PENDING after a successful Cashfree/Razorpay capture.
 * Requires the assessment result token so callers cannot inspect or unlock another lead's order.
 */
const schema = z.object({
  internalOrderId: z.string().uuid(),
  resultToken: z.string().min(20),
});

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid reconcile request." }, { status: 400 });

    const ipHash = requestIpHash(request) ?? "unknown";
    if (
      !rateLimit(`payment-reconcile:${parsed.data.internalOrderId}`, 12, 10 * 60 * 1000).allowed ||
      !rateLimit(`payment-reconcile-ip:${ipHash}`, 30, 10 * 60 * 1000).allowed
    ) {
      return NextResponse.json({ error: "Too many reconcile attempts. Please wait and try again." }, { status: 429 });
    }

    const access = await verifyAccessToken(parsed.data.resultToken, "result_access");
    const order = await prisma.order.findUnique({
      where: { id: parsed.data.internalOrderId },
      include: { payments: { orderBy: { createdAt: "desc" }, take: 1 }, reports: { select: { id: true }, take: 1 } },
    });
    if (!order || order.leadId !== access.leadId || (order.assessmentId && access.sub !== order.assessmentId)) {
      return NextResponse.json({ error: "Order not found for this assessment." }, { status: 404 });
    }

    if (order.status === "PAID" && order.reports[0]) {
      const reportToken = await signAccessToken("report_access", order.reports[0].id, { leadId: order.leadId, orderId: order.id }, "72h");
      return NextResponse.json({
        status: "paid",
        orderReference: order.orderReference,
        reportId: order.reports[0].id,
        reportToken,
      });
    }

    if (!order.providerOrderId) {
      return NextResponse.json({ error: "Payment order is not ready for reconciliation." }, { status: 409 });
    }

    const env = getServerEnv();
    const paymentProvider = (order.payments[0]?.provider || env.PAYMENT_PROVIDER) as PaymentProviderId;
    const provider = getPaymentProvider(paymentProvider);
    const verified = await provider.verifyClientPayment(
      {
        internalOrderId: order.id,
        providerOrderId: order.providerOrderId,
        expectedAmountPaise: Math.round(Number(order.totalAmount) * 100),
        raw: { order_id: order.providerOrderId },
      },
      order.providerOrderId,
      env,
    );

    if (!verified.ok) {
      return NextResponse.json({ status: "pending", error: verified.reason }, { status: 202 });
    }

    const processed = await processSuccessfulPayment({
      orderId: order.id,
      providerPaymentId: verified.providerPaymentId,
      provider: provider.id,
    });
    const reportToken = await signAccessToken("report_access", processed.report.id, { leadId: order.leadId, orderId: order.id }, "72h");
    const reportUrl = `${getPublicAppUrl()}/report/${processed.report.id}?token=${encodeURIComponent(reportToken)}`;
    Promise.all([
      sendWhatsAppTemplate(order.leadId, "PAYMENT_SUCCESS", { reference: order.orderReference }),
      sendWhatsAppTemplate(order.leadId, "REPORT_READY", { link: reportUrl }),
    ]).catch(() => undefined);

    return NextResponse.json({
      status: "paid",
      reconciled: true,
      orderReference: order.orderReference,
      reportId: processed.report.id,
      reportToken,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("payment_reconcile_failed", message === "INVALID_ORIGIN" ? message : "server_error");
    if (message === "INVALID_ORIGIN") return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    return NextResponse.json({ error: "Unable to reconcile payment status." }, { status: 500 });
  }
}
