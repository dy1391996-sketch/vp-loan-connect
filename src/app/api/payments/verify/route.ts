import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getPublicAppUrl, getServerEnv } from "@/lib/env";
import { getPaymentProvider, type PaymentProviderId } from "@/lib/payments";
import { processSuccessfulPayment } from "@/lib/payments/order-service";
import { sendWhatsAppTemplate } from "@/lib/providers/whatsapp";
import { assertSameOrigin, rateLimit, requestIpHash } from "@/lib/security/request";
import { signAccessToken } from "@/lib/security/tokens";

const schema = z
  .object({
    internalOrderId: z.string().uuid(),
    providerOrderId: z.string().min(3).optional(),
    providerPaymentId: z.string().min(3).optional(),
    signature: z.string().min(10).optional(),
    razorpay_order_id: z.string().min(3).optional(),
    razorpay_payment_id: z.string().min(3).optional(),
    razorpay_signature: z.string().min(10).optional(),
  })
  .passthrough();

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid payment response." }, { status: 400 });

    const ipHash = requestIpHash(request) ?? "unknown";
    if (
      !rateLimit(`payment-verify:${parsed.data.internalOrderId}`, 12, 10 * 60 * 1000).allowed ||
      !rateLimit(`payment-verify-ip:${ipHash}`, 40, 10 * 60 * 1000).allowed
    ) {
      return NextResponse.json({ error: "Too many verification attempts. Please wait and try again." }, { status: 429 });
    }

    const env = getServerEnv();
    const order = await prisma.order.findUnique({
      where: { id: parsed.data.internalOrderId },
      include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!order) return NextResponse.json({ error: "Payment order mismatch." }, { status: 400 });

    const paymentProvider = (order.payments[0]?.provider || env.PAYMENT_PROVIDER) as PaymentProviderId;
    const provider = getPaymentProvider(paymentProvider);
    const verified = await provider.verifyClientPayment(
      {
        internalOrderId: parsed.data.internalOrderId,
        providerOrderId: parsed.data.providerOrderId || parsed.data.razorpay_order_id,
        providerPaymentId: parsed.data.providerPaymentId || parsed.data.razorpay_payment_id,
        signature: parsed.data.signature || parsed.data.razorpay_signature,
        expectedAmountPaise: Math.round(Number(order.totalAmount) * 100),
        raw: parsed.data as Record<string, unknown>,
      },
      order.providerOrderId,
      env,
    );

    if (!verified.ok) {
      const status = verified.reason.includes("not configured") ? 503 : 400;
      return NextResponse.json({ error: verified.reason }, { status });
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
    return NextResponse.json({ verified: true, orderReference: order.orderReference, reportId: processed.report.id, reportToken });
  } catch (error) {
    console.error("payment_verify_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Unable to verify payment. Contact support with your payment reference." }, { status: 500 });
  }
}
