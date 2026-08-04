import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { getPaymentProvider, type PaymentProviderId } from "@/lib/payments";
import { processSuccessfulPayment } from "@/lib/payments/order-service";
import { assertSameOrigin, rateLimit, requestIpHash } from "@/lib/security/request";
import { signAccessToken, verifyAccessToken } from "@/lib/security/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  order: z.string().min(6).max(64),
  token: z.string().min(20),
});

/**
 * Normalized payment status for pending-page polling.
 * Ownership: result_access token for the assessment/lead that owns the order.
 * Never returns gateway secrets or full provider payloads.
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Missing order or access token." }, { status: 400 });
    }

    const ipHash = requestIpHash(request) ?? "unknown";
    if (
      !rateLimit(`payment-status:${parsed.data.order}`, 30, 10 * 60 * 1000).allowed ||
      !rateLimit(`payment-status-ip:${ipHash}`, 60, 10 * 60 * 1000).allowed
    ) {
      return NextResponse.json({ error: "Too many status checks. Please wait." }, { status: 429 });
    }

    const access = await verifyAccessToken(parsed.data.token, "result_access");
    const order = await prisma.order.findUnique({
      where: { orderReference: parsed.data.order },
      include: {
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
        reports: { select: { id: true }, take: 1 },
      },
    });
    if (!order || order.leadId !== access.leadId || (order.assessmentId && access.sub !== order.assessmentId)) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
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

    if (order.status === "FAILED" || order.status === "CANCELLED") {
      return NextResponse.json({ status: "failed", orderReference: order.orderReference });
    }

    if (order.providerOrderId && (order.status === "PENDING" || order.status === "CREATED")) {
      if (!rateLimit(`payment-status-reconcile:${order.id}`, 6, 10 * 60 * 1000).allowed) {
        return NextResponse.json({ status: "pending", orderReference: order.orderReference });
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
      if (verified.ok) {
        const processed = await processSuccessfulPayment({
          orderId: order.id,
          providerPaymentId: verified.providerPaymentId,
          provider: provider.id,
        });
        const reportToken = await signAccessToken("report_access", processed.report.id, { leadId: order.leadId, orderId: order.id }, "72h");
        return NextResponse.json({
          status: "paid",
          orderReference: order.orderReference,
          reportId: processed.report.id,
          reportToken,
          reconciled: true,
        });
      }

      if (/ended without payment|USER_DROPPED|EXPIRED|TERMINATED|FAILED|CANCELLED/i.test(verified.reason)) {
        await prisma.order.update({ where: { id: order.id }, data: { status: "FAILED" } }).catch(() => undefined);
        return NextResponse.json({ status: "failed", orderReference: order.orderReference, reason: verified.reason });
      }
    }

    return NextResponse.json({ status: "pending", orderReference: order.orderReference });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (message === "INVALID_ORIGIN") return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    if (/invalid|expired|JWT|token|TOKEN_/i.test(message)) {
      return NextResponse.json({ error: "Invalid access token." }, { status: 401 });
    }
    console.error("payment_status_failed", "server_error");
    return NextResponse.json({ error: "Unable to read payment status." }, { status: 500 });
  }
}
