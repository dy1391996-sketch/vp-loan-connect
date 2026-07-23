import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getPublicAppUrl, getServerEnv } from "@/lib/env";
import { processSuccessfulPayment } from "@/lib/payments/order-service";
import { verifyRazorpayPaymentSignature } from "@/lib/payments/razorpay";
import { sendWhatsAppTemplate } from "@/lib/providers/whatsapp";
import { assertSameOrigin } from "@/lib/security/request";
import { signAccessToken } from "@/lib/security/tokens";

const schema = z.object({ internalOrderId: z.string().uuid(), razorpay_order_id: z.string().min(3), razorpay_payment_id: z.string().min(3), razorpay_signature: z.string().min(10) });

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid payment response." }, { status: 400 });
    const env = getServerEnv();
    const order = await prisma.order.findUnique({ where: { id: parsed.data.internalOrderId } });
    if (!order || order.providerOrderId !== parsed.data.razorpay_order_id) return NextResponse.json({ error: "Payment order mismatch." }, { status: 400 });
    if (!env.RAZORPAY_KEY_SECRET) return NextResponse.json({ error: "Payment verification is not configured." }, { status: 503 });
    if (!verifyRazorpayPaymentSignature(parsed.data.razorpay_order_id, parsed.data.razorpay_payment_id, parsed.data.razorpay_signature, env.RAZORPAY_KEY_SECRET)) {
      return NextResponse.json({ error: "Payment signature verification failed." }, { status: 400 });
    }

    const processed = await processSuccessfulPayment({ orderId: order.id, providerPaymentId: parsed.data.razorpay_payment_id, provider: "razorpay" });
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
