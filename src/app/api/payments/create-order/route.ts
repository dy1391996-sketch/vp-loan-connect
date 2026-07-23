import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createProviderOrder } from "@/lib/payments/razorpay";
import { datedReference } from "@/lib/payments/order-service";
import { assertSameOrigin, rateLimit } from "@/lib/security/request";
import { verifyAccessToken } from "@/lib/security/tokens";

const schema = z.object({ assessmentId: z.string().uuid(), productSlug: z.enum(["credit-health-action-plan", "complete-loan-readiness-report"]), resultToken: z.string().min(20), referralCode: z.string().max(20).optional() });

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request); const parsed = schema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
    const token = await verifyAccessToken(parsed.data.resultToken, "result_access"); if (token.sub !== parsed.data.assessmentId || typeof token.leadId !== "string") return NextResponse.json({ error: "Secure assessment access is invalid." }, { status: 403 });
    if (!rateLimit(`checkout:${token.leadId}`, 10, 60 * 60 * 1000).allowed) return NextResponse.json({ error: "Too many checkout attempts." }, { status: 429 });
    const [assessment, product] = await Promise.all([prisma.assessment.findUnique({ where: { id: parsed.data.assessmentId } }), prisma.product.findUnique({ where: { slug: parsed.data.productSlug } })]);
    if (!assessment || assessment.leadId !== token.leadId || assessment.status !== "COMPLETED" || !product?.active) return NextResponse.json({ error: "Assessment or product is unavailable." }, { status: 404 });
    const subtotal = Number(product.salePrice); const gstAmount = Math.round(subtotal * Number(product.gstRate)) / 100; const totalAmount = Math.round((subtotal + gstAmount) * 100) / 100;
    const order = await prisma.order.create({ data: { orderReference: datedReference("VPLC-ORD"), leadId: assessment.leadId, assessmentId: assessment.id, productId: product.id, subtotal, gstAmount, totalAmount, status: "CREATED", referralCode: parsed.data.referralCode || assessment.referralCode, source: assessment.source } });
    try {
      const provider = await createProviderOrder({ amountPaise: Math.round(totalAmount * 100), receipt: order.orderReference, notes: { internal_order_id: order.id, product: product.slug, referral: order.referralCode ?? "" } });
      await prisma.$transaction([prisma.order.update({ where: { id: order.id }, data: { providerOrderId: provider.orderId, status: "PENDING" } }), prisma.payment.create({ data: { orderId: order.id, provider: provider.provider, amount: totalAmount, status: "CREATED" } }), prisma.lead.update({ where: { id: order.leadId }, data: { stage: "PAYMENT_PENDING" } })]);
      return NextResponse.json({ internalOrderId: order.id, orderReference: order.orderReference, provider: provider.provider, providerOrderId: provider.orderId, keyId: provider.keyId, amountPaise: Math.round(totalAmount * 100), currency: "INR", name: "VP Loan Connect", description: product.name });
    } catch (error) { await prisma.order.update({ where: { id: order.id }, data: { status: "FAILED" } }); throw error; }
  } catch (error) { console.error("create_order_failed", error instanceof Error ? error.message : "unknown"); return NextResponse.json({ error: "Unable to open checkout right now." }, { status: 500 }); }
}
