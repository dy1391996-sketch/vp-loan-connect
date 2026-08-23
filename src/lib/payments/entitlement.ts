import { USP_PRODUCT_SLUG } from "@/lib/constants";
import { prisma } from "@/lib/db";

export type BoosterPaymentState = "UNPAID" | "PENDING" | "PAID";

export function classifyBoosterPaymentState(orders: Array<{ status: string }>): BoosterPaymentState {
  if (orders.some((order) => order.status === "PAID")) return "PAID";
  if (orders.some((order) => order.status === "PENDING" || order.status === "CREATED")) return "PENDING";
  return "UNPAID";
}

export function canAccessPaidAssessment(state: BoosterPaymentState): boolean {
  return state === "PAID";
}

export function paidAssessmentGate(state: BoosterPaymentState): {
  allow: boolean;
  code: "OK" | "PAYMENT_REQUIRED" | "PAYMENT_PENDING";
} {
  if (state === "PAID") return { allow: true, code: "OK" };
  if (state === "PENDING") return { allow: false, code: "PAYMENT_PENDING" };
  return { allow: false, code: "PAYMENT_REQUIRED" };
}

export async function readBoosterEntitlement(assessmentId: string, leadId: string) {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      score: { select: { id: true } },
      orders: {
        where: { product: { slug: USP_PRODUCT_SLUG } },
        select: { id: true, status: true },
      },
    },
  });
  if (!assessment || assessment.leadId !== leadId) return null;
  const paymentStatus = classifyBoosterPaymentState(assessment.orders);
  return {
    assessmentId: assessment.id,
    status: assessment.status,
    paymentStatus,
    paid: paymentStatus === "PAID",
    hasScore: Boolean(assessment.score),
  };
}
