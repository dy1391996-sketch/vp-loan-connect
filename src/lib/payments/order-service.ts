import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { randomInt } from "node:crypto";
import { randomToken, sha256 } from "@/lib/utils";
import { qualifiesForReferralReward } from "@/lib/domain/referrals";

export function datedReference(prefix: "VPLC-ORD" | "VPLC") {
  const now = new Date();
  const date = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `${prefix}-${date}-${String(randomInt(0, 10000)).padStart(4, "0")}`;
}

export async function processSuccessfulPayment(input: { orderId: string; providerPaymentId: string; provider: string }) {
  return prisma.$transaction(async (tx) => {
    // Serialize webhook, return-handler, and polling finalization for this order.
    // Without the row lock, simultaneous confirmations can both attempt to
    // create a report before the unique orderId constraint is visible.
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${input.orderId}::uuid FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id: input.orderId }, include: { lead: true, assessment: { include: { score: true, answers: true } }, product: true, reports: true } });
    if (!order || !order.assessment?.score) throw new Error("Order assessment is unavailable.");
    const [paymentByProviderId, paymentForOrder] = await Promise.all([
      tx.payment.findUnique({ where: { providerPaymentId: input.providerPaymentId } }),
      tx.payment.findFirst({ where: { orderId: order.id }, orderBy: { createdAt: "asc" } }),
    ]);
    if (paymentByProviderId && paymentByProviderId.orderId !== order.id) {
      throw new Error("Payment reference is already linked to another order.");
    }
    const paidAt = new Date();
    if (order.status === "PAID" && order.reports[0]) {
      let duplicateCharge = paymentByProviderId;
      if (!duplicateCharge) {
        duplicateCharge = await tx.payment.create({
          data: {
            orderId: order.id,
            provider: input.provider,
            providerPaymentId: input.providerPaymentId,
            amount: order.totalAmount,
            currency: order.currency,
            status: "CAPTURED",
            capturedAt: paidAt,
          },
        });
        await tx.refund.create({
          data: {
            orderId: order.id,
            amount: order.totalAmount,
            reason: `Automatic review required: duplicate successful ${input.provider} payment ${input.providerPaymentId}`,
            status: "REQUESTED",
          },
        });
        await tx.auditLog.create({
          data: {
            action: "DUPLICATE_PAYMENT_DETECTED",
            entityType: "Payment",
            entityId: duplicateCharge.id,
            metadata: {
              orderId: order.id,
              provider: input.provider,
              providerPaymentId: input.providerPaymentId,
              refundStatus: "REQUESTED",
            },
          },
        });
      }
      return {
        order,
        payment: duplicateCharge,
        report: order.reports[0],
        duplicate: true,
        duplicateCharge: !paymentByProviderId,
      };
    }
    const existingPayment =
      paymentByProviderId || (paymentForOrder?.status === "CAPTURED" ? null : paymentForOrder);
    const payment = existingPayment
      ? await tx.payment.update({
          where: { id: existingPayment.id },
          data: {
            provider: input.provider,
            providerPaymentId: input.providerPaymentId,
            amount: order.totalAmount,
            currency: order.currency,
            status: "CAPTURED",
            failureCode: null,
            failureDescription: null,
            capturedAt: paidAt,
          },
        })
      : await tx.payment.create({ data: { orderId: order.id, provider: input.provider, providerPaymentId: input.providerPaymentId, amount: order.totalAmount, currency: order.currency, status: "CAPTURED", capturedAt: paidAt } });
    const paidOrder = await tx.order.update({ where: { id: order.id }, data: { status: "PAID", paidAt } });
    await tx.lead.update({ where: { id: order.leadId }, data: { stage: "REPORT_PROCESSING" } });
    const rawToken = randomToken(32);
    const snapshot: Prisma.InputJsonValue = JSON.parse(JSON.stringify({
      customerName: order.lead.fullName,
      assessmentDate: order.assessment.completedAt,
      loanType: order.assessment.loanType,
      loanAmount: order.assessment.loanAmount?.toString(),
      employmentType: order.assessment.employmentType,
      monthlyIncomeRange: order.assessment.monthlyIncomeRange,
      existingEmi: order.assessment.existingEmi?.toString(),
      creditRange: order.assessment.creditRange,
      score: order.assessment.score,
      answers: order.assessment.answers,
      productName: order.product.name,
    }));
    const report = await tx.report.create({ data: { reportReference: datedReference("VPLC"), leadId: order.leadId, assessmentId: order.assessment.id, orderId: order.id, type: order.product.type, status: "QUEUED", snapshot, accessTokenHash: sha256(rawToken), accessTokenExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000) } });

    if (order.referralCode) {
      const referral = await tx.referral.findUnique({ where: { referredLeadId: order.leadId } });
      if (referral && referral.referrerLeadId !== order.leadId && qualifiesForReferralReward({ orderStatus: "PAID", refunded: false, productType: order.product.type, existingRewardForOrder: false })) {
        const rewardSetting = await tx.appSetting.findUnique({ where: { key: "referral_reward_credit_health" } });
        const validationSetting = await tx.appSetting.findUnique({ where: { key: "referral_validation_days" } });
        const amount = Number((rewardSetting?.value as { amount?: number } | null)?.amount ?? 20);
        const days = Number(validationSetting?.value ?? 14);
        await tx.referralReward.upsert({ where: { orderId: order.id }, update: {}, create: { referrerLeadId: referral.referrerLeadId, orderId: order.id, amount, validationEndsAt: new Date(Date.now() + days * 86400000) } });
      }
    }
    return { order: { ...order, ...paidOrder }, payment, report, rawToken, duplicate: false };
  });
}
