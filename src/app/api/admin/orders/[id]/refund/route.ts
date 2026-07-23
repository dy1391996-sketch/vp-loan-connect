import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { createProviderRefund } from "@/lib/payments/razorpay";
import { assertSameOrigin, requestIpHash, sanitizeText } from "@/lib/security/request";

const schema = z.object({ amount: z.number().positive().max(1000000), reason: z.string().trim().min(10).max(1000), confirmed: z.literal(true) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  assertSameOrigin(request);
  const { admin } = await requireAdmin(["SUPER_ADMIN", "ADMIN"]);
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid amount, a detailed reason and confirm the refund." }, { status: 400 });
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id }, include: { payments: { where: { status: { in: ["CAPTURED", "PARTIALLY_REFUNDED"] } }, orderBy: { capturedAt: "desc" } }, refunds: true, referralReward: true } });
  const payment = order?.payments[0];
  if (!order || !payment?.providerPaymentId || !["PAID", "PARTIALLY_REFUNDED"].includes(order.status)) return NextResponse.json({ error: "A captured refundable payment was not found." }, { status: 404 });
  const refunded = order.refunds.filter((item) => item.status === "COMPLETED").reduce((sum, item) => sum + Number(item.amount), 0);
  const refundable = Math.round((Number(order.totalAmount) - refunded) * 100) / 100;
  if (parsed.data.amount > refundable) return NextResponse.json({ error: `Maximum refundable amount is ₹${refundable.toFixed(2)}.` }, { status: 400 });
  const refund = await prisma.refund.create({ data: { orderId: order.id, amount: parsed.data.amount, reason: sanitizeText(parsed.data.reason), status: "PROCESSING", approvedBy: admin.id } });
  try {
    const provider = await createProviderRefund({ paymentId: payment.providerPaymentId, amountPaise: Math.round(parsed.data.amount * 100), refundReference: refund.id });
    const full = Math.abs(parsed.data.amount - refundable) < 0.01;
    await prisma.$transaction([
      prisma.refund.update({ where: { id: refund.id }, data: { providerRefundId: provider.refundId, status: "COMPLETED", processedAt: new Date() } }),
      prisma.order.update({ where: { id: order.id }, data: { status: full ? "REFUNDED" : "PARTIALLY_REFUNDED" } }),
      prisma.payment.update({ where: { id: payment.id }, data: { status: full ? "REFUNDED" : "PARTIALLY_REFUNDED" } }),
      ...(order.referralReward ? [prisma.referralReward.update({ where: { id: order.referralReward.id }, data: { status: "REVERSED" } })] : []),
      prisma.auditLog.create({ data: { adminId: admin.id, action: "PAYMENT_REFUND_COMPLETED", entityType: "Order", entityId: order.id, metadata: { refundId: refund.id, amount: parsed.data.amount, reason: parsed.data.reason }, ipHash: requestIpHash(request), userAgent: request.headers.get("user-agent")?.slice(0, 500) } }),
    ]);
    return NextResponse.json({ refunded: true, providerRefundId: provider.refundId });
  } catch (error) {
    await prisma.refund.update({ where: { id: refund.id }, data: { status: "FAILED" } });
    console.error("admin_refund_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Provider refund failed. No completed refund was recorded." }, { status: 502 });
  }
}
