import type { PricingRule, Studio } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isWeekend } from "@/lib/utils";

export type PriceQuoteInput = {
  checkInAt: Date;
  durationHours: number;
  studioId?: string;
  studio?: Pick<Studio, "id" | "isPremium" | "hasBalcony" | "hasJacuzzi" | "category" | "weekdayPriceInr" | "weekendPriceInr" | "hourlyPriceInr">;
  couponCode?: string;
  returningCustomer?: boolean;
  occupancyRate?: number;
  manualOverrideInr?: number;
  /** Only apply discounts that exist in DB and are approved */
  allowUnapprovedDiscounts?: boolean;
};

export type PriceQuote = {
  baseAmountInr: number;
  discountInr: number;
  totalAmountInr: number;
  tokenAmountInr: number;
  appliedRules: { id: string; name: string; type: string; amountInr: number }[];
  dayType: "WEEKDAY" | "WEEKEND";
  matchedSlab: string | null;
};

function clampHours(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) throw new Error("Duration must be a positive number of hours.");
  return Math.round(hours);
}

function findSlab(rules: PricingRule[], dayType: "WEEKDAY" | "WEEKEND", hours: number) {
  const slabs = rules.filter(
    (r) =>
      r.active &&
      r.approved &&
      (r.type === "WEEKDAY_SLAB" || r.type === "WEEKEND_SLAB") &&
      r.dayType === dayType &&
      r.minHours != null &&
      r.maxHours != null &&
      hours >= r.minHours &&
      hours <= r.maxHours,
  );
  return slabs.sort((a, b) => a.priority - b.priority)[0] ?? null;
}

function findHourly(rules: PricingRule[], dayType: "WEEKDAY" | "WEEKEND") {
  return (
    rules
      .filter((r) => r.active && r.approved && r.type === "HOURLY" && (r.dayType === dayType || r.dayType === "ANY"))
      .sort((a, b) => a.priority - b.priority)[0] ?? null
  );
}

export function calculatePriceFromRules(rules: PricingRule[], input: PriceQuoteInput, tokenPercent: number): PriceQuote {
  const durationHours = clampHours(input.durationHours);
  const dayType = isWeekend(input.checkInAt) ? "WEEKEND" : "WEEKDAY";
  const applied: PriceQuote["appliedRules"] = [];

  if (input.manualOverrideInr != null) {
    if (input.manualOverrideInr < 0) throw new Error("Manual override cannot be negative.");
    const total = Math.round(input.manualOverrideInr);
    return {
      baseAmountInr: total,
      discountInr: 0,
      totalAmountInr: total,
      tokenAmountInr: Math.max(1, Math.round((total * tokenPercent) / 100)),
      appliedRules: [{ id: "manual", name: "Manual override", type: "MANUAL_OVERRIDE", amountInr: total }],
      dayType,
      matchedSlab: "manual_override",
    };
  }

  let base = 0;
  let matchedSlab: string | null = null;
  const slab = findSlab(rules, dayType, durationHours);
  if (slab) {
    base = slab.amountInr;
    matchedSlab = slab.name;
    applied.push({ id: slab.id, name: slab.name, type: slab.type, amountInr: slab.amountInr });
  } else {
    const hourly = findHourly(rules, dayType);
    if (!hourly) throw new Error("No pricing rule found for this duration.");
    base = hourly.amountInr * durationHours;
    matchedSlab = hourly.name;
    applied.push({ id: hourly.id, name: hourly.name, type: hourly.type, amountInr: base });
  }

  // Studio-level overrides take precedence over generic slabs when set
  const studio = input.studio;
  if (studio) {
    if (dayType === "WEEKDAY" && studio.weekdayPriceInr != null && durationHours === 24) {
      base = studio.weekdayPriceInr;
      matchedSlab = "studio_weekday_24h";
    }
    if (dayType === "WEEKEND" && studio.weekendPriceInr != null && durationHours === 24) {
      base = studio.weekendPriceInr;
      matchedSlab = "studio_weekend_24h";
    }
    if (studio.hourlyPriceInr != null && !slab) {
      base = studio.hourlyPriceInr * durationHours;
      matchedSlab = "studio_hourly";
    }
  }

  // Premium / feature surcharges (approved rules only)
  const surcharges = rules.filter(
    (r) =>
      r.active &&
      r.approved &&
      r.type === "PREMIUM_SURCHARGE" &&
      (!r.studioId || r.studioId === studio?.id) &&
      (!r.category || r.category === studio?.category),
  );
  for (const rule of surcharges) {
    if (studio?.isPremium || studio?.hasBalcony || studio?.hasJacuzzi || studio?.category === "PREMIUM_VIEW") {
      const amount = rule.isPercent ? Math.round((base * (rule.percentValue ?? 0)) / 100) : rule.amountInr;
      base += amount;
      applied.push({ id: rule.id, name: rule.name, type: rule.type, amountInr: amount });
    }
  }

  // Special date / holiday
  const dateRules = rules.filter(
    (r) =>
      r.active &&
      r.approved &&
      (r.type === "SPECIAL_DATE" || r.type === "HOLIDAY") &&
      r.specialDate &&
      input.checkInAt >= r.specialDate &&
      (!r.specialDateEnd || input.checkInAt <= r.specialDateEnd),
  );
  for (const rule of dateRules.sort((a, b) => a.priority - b.priority)) {
    if (rule.isPercent) {
      const delta = Math.round((base * (rule.percentValue ?? 0)) / 100);
      base += delta;
      applied.push({ id: rule.id, name: rule.name, type: rule.type, amountInr: delta });
    } else if (rule.minHours != null && rule.maxHours != null) {
      if (durationHours >= rule.minHours && durationHours <= rule.maxHours) {
        base = rule.amountInr;
        applied.push({ id: rule.id, name: rule.name, type: rule.type, amountInr: rule.amountInr });
      }
    }
  }

  let discount = 0;
  const discountTypes = ["RETURNING_CUSTOMER", "LONG_STAY", "LAST_MINUTE", "OCCUPANCY", "COUPON"] as const;

  for (const type of discountTypes) {
    const candidates = rules.filter((r) => r.active && r.approved && r.type === type);
    for (const rule of candidates.sort((a, b) => a.priority - b.priority)) {
      if (type === "RETURNING_CUSTOMER" && !input.returningCustomer) continue;
      if (type === "LONG_STAY" && (rule.minHours == null || durationHours < rule.minHours)) continue;
      if (type === "COUPON") {
        if (!input.couponCode || rule.couponCode?.toUpperCase() !== input.couponCode.toUpperCase()) continue;
      }
      if (type === "OCCUPANCY") {
        const occ = input.occupancyRate ?? 0;
        if (rule.minOccupancy != null && occ < rule.minOccupancy) continue;
        if (rule.maxOccupancy != null && occ > rule.maxOccupancy) continue;
      }
      if (rule.requiresOwnerApproval && !rule.approved) continue;
      const amount = rule.isPercent ? Math.round((base * (rule.percentValue ?? 0)) / 100) : rule.amountInr;
      discount += amount;
      applied.push({ id: rule.id, name: rule.name, type: rule.type, amountInr: -amount });
    }
  }

  discount = Math.min(discount, base);
  const total = Math.max(0, base - discount);
  return {
    baseAmountInr: base,
    discountInr: discount,
    totalAmountInr: total,
    tokenAmountInr: Math.max(1, Math.round((total * tokenPercent) / 100)),
    appliedRules: applied,
    dayType,
    matchedSlab,
  };
}

export async function calculateBookingPrice(input: PriceQuoteInput & { tokenPercent?: number }): Promise<PriceQuote> {
  const rules = await prisma.pricingRule.findMany({ where: { active: true } });
  let studio = input.studio;
  if (!studio && input.studioId) {
    studio = await prisma.studio.findUniqueOrThrow({
      where: { id: input.studioId },
      select: {
        id: true,
        isPremium: true,
        hasBalcony: true,
        hasJacuzzi: true,
        category: true,
        weekdayPriceInr: true,
        weekendPriceInr: true,
        hourlyPriceInr: true,
      },
    });
  }
  const { getServerEnv } = await import("@/lib/env");
  const tokenPercent = input.tokenPercent ?? getServerEnv().TOKEN_PERCENT;
  return calculatePriceFromRules(rules, { ...input, studio }, tokenPercent);
}
