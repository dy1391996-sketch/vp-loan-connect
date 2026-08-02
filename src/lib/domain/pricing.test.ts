import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PricingRule } from "@prisma/client";
import { calculatePriceFromRules } from "@/lib/domain/pricing";
import { rangesOverlap, isWeekend } from "@/lib/utils";
import { computeBookingProbability, temperatureFromProbability } from "@/lib/domain/leads";
import { verifyMetaSignature, verifyRazorpayWebhookSignature, safeEqualHex } from "@/lib/security/signatures";
import { createHmac } from "node:crypto";

function rule(partial: Partial<PricingRule> & Pick<PricingRule, "name" | "type" | "amountInr">): PricingRule {
  return {
    id: partial.id ?? crypto.randomUUID(),
    name: partial.name,
    type: partial.type,
    active: partial.active ?? true,
    priority: partial.priority ?? 10,
    minHours: partial.minHours ?? null,
    maxHours: partial.maxHours ?? null,
    dayType: partial.dayType ?? "ANY",
    specialDate: partial.specialDate ?? null,
    specialDateEnd: partial.specialDateEnd ?? null,
    amountInr: partial.amountInr,
    isPercent: partial.isPercent ?? false,
    percentValue: partial.percentValue ?? null,
    couponCode: partial.couponCode ?? null,
    studioId: partial.studioId ?? null,
    category: partial.category ?? null,
    minOccupancy: partial.minOccupancy ?? null,
    maxOccupancy: partial.maxOccupancy ?? null,
    returningOnly: partial.returningOnly ?? false,
    requiresOwnerApproval: partial.requiresOwnerApproval ?? false,
    approved: partial.approved ?? true,
    metadata: partial.metadata ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: null,
  };
}

describe("pricing engine", () => {
  const rules = [
    rule({ name: "Weekday 24h", type: "WEEKDAY_SLAB", dayType: "WEEKDAY", minHours: 24, maxHours: 24, amountInr: 2500 }),
    rule({ name: "Weekend 24h", type: "WEEKEND_SLAB", dayType: "WEEKEND", minHours: 24, maxHours: 24, amountInr: 3000 }),
    rule({ name: "Weekday 4-6", type: "WEEKDAY_SLAB", dayType: "WEEKDAY", minHours: 4, maxHours: 6, amountInr: 1499 }),
    rule({ name: "Weekday hourly", type: "HOURLY", dayType: "WEEKDAY", amountInr: 799 }),
    rule({ name: "WELCOME100", type: "COUPON", couponCode: "WELCOME100", amountInr: 100 }),
  ];

  it("uses weekday 24h slab", () => {
    // 2026-08-03 is a Monday
    const quote = calculatePriceFromRules(rules, { checkInAt: new Date("2026-08-03T12:00:00.000Z"), durationHours: 24 }, 30);
    assert.equal(quote.totalAmountInr, 2500);
    assert.equal(quote.tokenAmountInr, 750);
    assert.equal(quote.dayType, "WEEKDAY");
  });

  it("uses weekend 24h slab", () => {
    // 2026-08-01 is a Saturday
    const quote = calculatePriceFromRules(rules, { checkInAt: new Date("2026-08-01T12:00:00.000Z"), durationHours: 24 }, 30);
    assert.equal(quote.totalAmountInr, 3000);
    assert.equal(quote.dayType, "WEEKEND");
  });

  it("applies only approved coupon codes from DB rules", () => {
    const quote = calculatePriceFromRules(
      rules,
      { checkInAt: new Date("2026-08-03T12:00:00.000Z"), durationHours: 24, couponCode: "WELCOME100" },
      30,
    );
    assert.equal(quote.discountInr, 100);
    assert.equal(quote.totalAmountInr, 2400);
  });

  it("ignores unknown invented coupon", () => {
    const quote = calculatePriceFromRules(
      rules,
      { checkInAt: new Date("2026-08-03T12:00:00.000Z"), durationHours: 24, couponCode: "FAKE500" },
      30,
    );
    assert.equal(quote.discountInr, 0);
    assert.equal(quote.totalAmountInr, 2500);
  });

  it("respects manual override", () => {
    const quote = calculatePriceFromRules(
      rules,
      { checkInAt: new Date("2026-08-03T12:00:00.000Z"), durationHours: 24, manualOverrideInr: 1999 },
      30,
    );
    assert.equal(quote.totalAmountInr, 1999);
  });

  it("falls back to hourly when no slab matches", () => {
    const quote = calculatePriceFromRules(rules, { checkInAt: new Date("2026-08-03T12:00:00.000Z"), durationHours: 3 }, 30);
    assert.equal(quote.totalAmountInr, 799 * 3);
  });
});

describe("availability helpers", () => {
  it("detects range overlap", () => {
    const a0 = new Date("2026-08-01T10:00:00Z");
    const a1 = new Date("2026-08-01T14:00:00Z");
    const b0 = new Date("2026-08-01T13:00:00Z");
    const b1 = new Date("2026-08-01T16:00:00Z");
    assert.equal(rangesOverlap(a0, a1, b0, b1), true);
    assert.equal(rangesOverlap(a0, a1, new Date("2026-08-01T14:00:00Z"), b1), false);
  });

  it("detects weekend", () => {
    assert.equal(isWeekend(new Date("2026-08-01T12:00:00Z")), true);
    assert.equal(isWeekend(new Date("2026-08-03T12:00:00Z")), false);
  });
});

describe("lead scoring", () => {
  it("scores hot leads higher", () => {
    const p = computeBookingProbability({
      hasDate: true,
      studioSelected: true,
      paymentLinkRequested: true,
      urgent: true,
    });
    assert.ok(p >= 70);
    assert.equal(temperatureFromProbability(p), "HOT");
  });
});

describe("webhook signatures & idempotency keys", () => {
  it("verifies razorpay webhook hmac", () => {
    const secret = "whsec";
    const body = '{"event":"payment.captured"}';
    const sig = createHmac("sha256", secret).update(body).digest("hex");
    assert.equal(verifyRazorpayWebhookSignature(body, sig, secret), true);
    assert.equal(verifyRazorpayWebhookSignature(body, "deadbeef", secret), false);
  });

  it("verifies meta signature", () => {
    const secret = "appsecret";
    const body = '{"object":"whatsapp_business_account"}';
    const sig = createHmac("sha256", secret).update(body).digest("hex");
    assert.equal(verifyMetaSignature(body, `sha256=${sig}`, secret), true);
  });

  it("safeEqualHex rejects length mismatch", () => {
    assert.equal(safeEqualHex("aa", "aabb"), false);
  });
});
