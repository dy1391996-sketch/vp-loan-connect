import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { processSuccessfulPayment } from "@/lib/payments/order-service";
import { assertSameOrigin } from "@/lib/security/request";
import { signAccessToken, verifyAccessToken } from "@/lib/security/tokens";

const schema = z.object({ internalOrderId: z.string().uuid(), resultToken: z.string().min(20) });
export async function POST(request: NextRequest) { try { assertSameOrigin(request); const env = getServerEnv(); if (env.NODE_ENV === "production" || env.PAYMENT_PROVIDER !== "mock") return NextResponse.json({ error: "Not available." }, { status: 404 }); const parsed = schema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: "Invalid mock request." }, { status: 400 }); const token = await verifyAccessToken(parsed.data.resultToken, "result_access"); const order = await prisma.order.findUnique({ where: { id: parsed.data.internalOrderId } }); if (!order || token.sub !== order.assessmentId || token.leadId !== order.leadId) return NextResponse.json({ error: "Order access mismatch." }, { status: 403 }); const processed = await processSuccessfulPayment({ orderId: order.id, providerPaymentId: `mock_pay_${crypto.randomUUID()}`, provider: "mock" }); const reportToken = await signAccessToken("report_access", processed.report.id, { leadId: order.leadId, orderId: order.id }, "72h"); return NextResponse.json({ verified: true, orderReference: order.orderReference, reportId: processed.report.id, reportToken }); } catch (error) { console.error("mock_payment_failed", error instanceof Error ? error.message : "unknown"); return NextResponse.json({ error: "Mock payment failed." }, { status: 500 }); } }
