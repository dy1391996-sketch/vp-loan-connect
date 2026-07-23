import type { ProductType } from "@prisma/client";

export function isValidReferral(input: { referrerId: string; referredId: string; referrerMobile: string; referredMobile: string }) {
  return input.referrerId !== input.referredId && input.referrerMobile !== input.referredMobile;
}

export function qualifiesForReferralReward(input: { orderStatus: string; refunded: boolean; productType: ProductType; existingRewardForOrder: boolean }) {
  return input.orderStatus === "PAID" && !input.refunded && input.productType === "CREDIT_HEALTH_ACTION_PLAN" && !input.existingRewardForOrder;
}
