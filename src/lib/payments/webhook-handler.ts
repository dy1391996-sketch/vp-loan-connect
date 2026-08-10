import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPublicAppUrl, getServerEnv } from "@/lib/env";
import { getPaymentProvider, type PaymentProviderId } from "@/lib/payments";
import { fetchCashfreeOrder } from "@/lib/payments/providers/cashfree";
import { processSuccessfulPayment } from "@/lib/payments/order-service";
import { sendWhatsAppTemplate } from "@/lib/providers/whatsapp";
import { signAccessToken } from "@/lib/security/tokens";
import { sha256 } from "@/lib/utils";

function amountsMatchRupees(paid: number | undefined, expectedPaise: number) {
  if (paid == null || !Number.isFinite(paid)) return false;
  const paidPaise = Math.round(Number(paid) * 100);
  return Math.abs(paidPaise - expectedPaise) <= 1;
}

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
      include: {
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
        refunds: true,
        referralReward: true,
      },
    });

    // Prefer the recorded payment provider if present (supports gateway switches without breaking history).
    const recordedProvider = order?.payments[0]?.provider as PaymentProviderId | undefined;
    const unlockProvider = recordedProvider && recordedProvider === providerId ? recordedProvider : providerId;

    if (parsed.kind === "payment_captured" && order) {
      // Fail closed on amount/currency mismatches for Cashfree before unlocking.
      if (providerId === "cashfree") {
        const snapshot = await fetchCashfreeOrder(parsed.providerOrderId, env);
        const expectedPaise = Math.round(Number(order.totalAmount) * 100);
        if (String(snapshot.order_status || "").toUpperCase() !== "PAID") {
          throw new Error("Cashfree order is not PAID during webhook finalization.");
        }
        if (snapshot.order_currency && String(snapshot.order_currency).toUpperCase() !== "INR") {
          throw new Error("Cashfree webhook currency mismatch.");
        }
        if (order.currency.toUpperCase() !== "INR") {
          throw new Error("Stored order currency is not INR.");
        }
        if (!amountsMatchRupees(snapshot.order_amount, expectedPaise)) {
          console.error("cashfree_webhook_amount_mismatch", {
            orderId: order.id,
            expectedPaise,
            paid: snapshot.order_amount,
          });
          throw new Error("Cashfree webhook amount mismatch.");
        }
      }

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
      // Never overwrite a successfully paid order.
      if (order.status !== "PAID" && order.status !== "REFUNDED" && order.status !== "PARTIALLY_REFUNDED") {
        let providerOrderTerminal = true;
        if (providerId === "cashfree") {
          const snapshot = await fetchCashfreeOrder(parsed.providerOrderId, env);
          providerOrderTerminal = ["FAILED", "EXPIRED", "TERMINATED", "CANCELLED"].includes(
            String(snapshot.order_status || "").toUpperCase(),
          );
        }
        await prisma.order.update({
          where: { id: order.id },
          data: { status: providerOrderTerminal ? "FAILED" : "PENDING" },
        });
      }
    } else if (parsed.kind === "refund_update" && order) {
      const refund =
        (await prisma.refund.findFirst({ where: { providerRefundId: parsed.providerRefundId } })) ||
        (await prisma.refund.findFirst({
          where: { orderId: order.id, status: { in: ["REQUESTED", "PROCESSING", "APPROVED"] } },
          orderBy: { createdAt: "desc" },
        }));
      if (refund) {
        if (parsed.status === "COMPLETED") {
          const completedSum =
            order.refunds
              ?.filter((item) => item.status === "COMPLETED" && item.id !== refund.id)
              .reduce((sum, item) => sum + Number(item.amount), 0) ?? 0;
          const totalRefunded = completedSum + Number(refund.amount);
          const full = totalRefunded + 0.009 >= Number(order.totalAmount);
          const payment = await prisma.payment.findFirst({
            where: { orderId: order.id, status: { in: ["CAPTURED", "PARTIALLY_REFUNDED"] } },
            orderBy: { capturedAt: "desc" },
          });
          await prisma.$transaction([
            prisma.refund.update({
              where: { id: refund.id },
              data: { providerRefundId: parsed.providerRefundId, status: "COMPLETED", processedAt: new Date() },
            }),
            prisma.order.update({ where: { id: order.id }, data: { status: full ? "REFUNDED" : "PARTIALLY_REFUNDED" } }),
            ...(payment
              ? [prisma.payment.update({ where: { id: payment.id }, data: { status: full ? "REFUNDED" : "PARTIALLY_REFUNDED" } })]
              : []),
            ...(order.referralReward
              ? [prisma.referralReward.update({ where: { id: order.referralReward.id }, data: { status: "REVERSED" } })]
              : []),
          ]);
        } else if (parsed.status === "FAILED") {
          await prisma.refund.update({
            where: { id: refund.id },
            data: { providerRefundId: parsed.providerRefundId, status: "FAILED" },
          });
        } else {
          await prisma.refund.update({
            where: { id: refund.id },
            data: { providerRefundId: parsed.providerRefundId, status: "PROCESSING" },
          });
        }
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
