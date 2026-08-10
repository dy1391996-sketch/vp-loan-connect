import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { PrismaClient } from "@prisma/client";
import { processSuccessfulPayment } from "@/lib/payments/order-service";

/**
 * Money invariants that must hold no matter how many times a provider calls us:
 * one payment record, one paid order, one entitlement (report).
 * Runs against the CI/local Postgres instance configured by DATABASE_URL.
 */
const prisma = new PrismaClient();

const SUBTOTAL = 99;
const GST = 17.82;
const TOTAL = 116.82;

let productId = "";
const createdLeadIds: string[] = [];

async function makePaidableOrder() {
  const suffix = randomUUID().slice(0, 8);
  const lead = await prisma.lead.create({
    data: {
      fullName: "Entitlement Test",
      mobile: `+9199${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
      referralCode: `ENT${suffix}`.toUpperCase(),
    },
  });
  createdLeadIds.push(lead.id);

  const assessment = await prisma.assessment.create({
    data: {
      leadId: lead.id,
      status: "COMPLETED",
      loanType: "PERSONAL",
      employmentType: "SALARIED",
      creditRange: "GOOD",
      completedAt: new Date(),
      score: {
        create: {
          readinessScore: 72,
          readinessLabel: "Good",
          emiBurden: "Moderate",
          documentationStatus: "Partial",
          creditHealthStatus: "Healthy",
          comfortableEmiMin: 5000,
          comfortableEmiMax: 12000,
          suitableCategories: ["PERSONAL"],
          strengths: [],
          improvements: [],
          factorBreakdown: {},
          engineVersion: "test",
        },
      },
    },
  });

  const order = await prisma.order.create({
    data: {
      orderReference: `VPLC-ORD-TEST-${suffix}`,
      leadId: lead.id,
      assessmentId: assessment.id,
      productId,
      subtotal: SUBTOTAL,
      gstAmount: GST,
      totalAmount: TOTAL,
      status: "PENDING",
      providerOrderId: `cf_test_${suffix}`,
    },
  });
  return order;
}

describe("paid entitlement creation", () => {
  before(async () => {
    const product = await prisma.product.findFirst({ where: { type: "CREDIT_HEALTH_ACTION_PLAN" } });
    productId =
      product?.id ??
      (
        await prisma.product.create({
          data: {
            slug: "credit-health-action-plan",
            name: "Credit Profile Booster",
            type: "CREDIT_HEALTH_ACTION_PLAN",
            regularPrice: 299,
            salePrice: SUBTOTAL,
            gstRate: 0.18,
            deliverables: [],
          },
        })
      ).id;
  });

  after(async () => {
    for (const leadId of createdLeadIds) {
      await prisma.lead.delete({ where: { id: leadId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it("marks the order paid and creates exactly one entitlement", async () => {
    const order = await makePaidableOrder();
    const result = await processSuccessfulPayment({
      orderId: order.id,
      providerPaymentId: `cfpay_${order.id}`,
      provider: "cashfree",
    });

    assert.equal(result.duplicate, false);
    const paid = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    assert.equal(paid.status, "PAID");
    assert.equal(Number(paid.totalAmount), TOTAL);
    assert.ok(paid.paidAt);

    const reports = await prisma.report.findMany({ where: { orderId: order.id } });
    assert.equal(reports.length, 1, "exactly one entitlement per paid order");

    const payments = await prisma.payment.findMany({ where: { orderId: order.id } });
    assert.equal(payments.length, 1, "exactly one payment record");
    assert.equal(payments[0]!.status, "CAPTURED");
    assert.equal(Number(payments[0]!.amount), TOTAL);
  });

  it("treats a duplicate webhook for the same payment as a no-op", async () => {
    const order = await makePaidableOrder();
    const providerPaymentId = `cfpay_dup_${order.id}`;
    const first = await processSuccessfulPayment({ orderId: order.id, providerPaymentId, provider: "cashfree" });
    const second = await processSuccessfulPayment({ orderId: order.id, providerPaymentId, provider: "cashfree" });

    assert.equal(first.duplicate, false);
    assert.equal(second.duplicate, true, "replayed webhook must not create a second entitlement");
    assert.equal(second.report.id, first.report.id);

    const reports = await prisma.report.findMany({ where: { orderId: order.id } });
    assert.equal(reports.length, 1);
    const payments = await prisma.payment.findMany({ where: { orderId: order.id } });
    assert.equal(payments.length, 1);
  });

  it("keeps one entitlement when the return handler and webhook land at the same time", async () => {
    const order = await makePaidableOrder();
    const providerPaymentId = `cfpay_race_${order.id}`;
    const results = await Promise.allSettled([
      processSuccessfulPayment({ orderId: order.id, providerPaymentId, provider: "cashfree" }),
      processSuccessfulPayment({ orderId: order.id, providerPaymentId, provider: "cashfree" }),
    ]);

    assert.ok(
      results.some((entry) => entry.status === "fulfilled"),
      "at least one concurrent finalization must succeed",
    );
    const reports = await prisma.report.findMany({ where: { orderId: order.id } });
    assert.equal(reports.length, 1, "concurrent finalization must not double-unlock");
    const payments = await prisma.payment.findMany({ where: { orderId: order.id } });
    assert.equal(payments.length, 1, "concurrent finalization must not double-charge the record");
  });

  it("refuses to attach one provider payment id to a second order", async () => {
    const first = await makePaidableOrder();
    const second = await makePaidableOrder();
    const providerPaymentId = `cfpay_shared_${first.id}`;
    await processSuccessfulPayment({ orderId: first.id, providerPaymentId, provider: "cashfree" });

    await assert.rejects(
      () => processSuccessfulPayment({ orderId: second.id, providerPaymentId, provider: "cashfree" }),
      /already linked to another order/i,
    );
    const secondOrder = await prisma.order.findUniqueOrThrow({ where: { id: second.id } });
    assert.notEqual(secondOrder.status, "PAID", "an unrelated order must stay unpaid");
    assert.equal((await prisma.report.findMany({ where: { orderId: second.id } })).length, 0);
  });
});
