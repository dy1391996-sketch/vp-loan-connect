/**
 * Meta Pixel / Conversions API event catalog for VP Loan Connect.
 * Browser and server share the same event names + event_id for deduplication.
 */

export const META_FUNNEL_EVENTS = [
  "LandingPageView",
  "QuickApplyStarted",
  "OTPVerified",
  "AssessmentCompleted",
  "EligibilityViewed",
  "CheckoutStarted",
  "PaymentSuccess",
  "Purchase",
  "InstagramProfileClick",
  "InstagramAdLanding",
] as const;

export type MetaFunnelEvent = (typeof META_FUNNEL_EVENTS)[number];

/** Map first-party analytics names → Meta funnel events (may emit multiple). */
export const FIRST_PARTY_TO_META: Record<string, MetaFunnelEvent[]> = {
  // LandingPageView / InstagramAdLanding are emitted once from AnalyticsProvider after consent
  // (avoids double-fire when first-party homepage_visit runs before consent is granted).
  assessment_started: ["QuickApplyStarted"],
  email_verified: ["OTPVerified"],
  mobile_verified: ["OTPVerified"],
  assessment_completed: ["AssessmentCompleted"],
  free_result_viewed: ["EligibilityViewed"],
  checkout_opened: ["CheckoutStarted"],
  checkout_resumed: ["CheckoutStarted"],
  booster_checkout_started: ["CheckoutStarted"],
  payment_order_created: ["CheckoutStarted"],
  cashfree_checkout_opened: ["CheckoutStarted"],
  // Pixel/CAPI standard name is Purchase; funnel label PaymentSuccess is kept in custom_data.
  payment_completed: ["PaymentSuccess"],
  instagram_profile_click: ["InstagramProfileClick"],
};

/** Standard Meta event names where applicable; custom events keep funnel names. */
export function metaPixelEventName(event: MetaFunnelEvent): string {
  switch (event) {
    case "LandingPageView":
      return "PageView";
    case "Purchase":
    case "PaymentSuccess":
      return "Purchase";
    case "CheckoutStarted":
      return "InitiateCheckout";
    case "OTPVerified":
    case "AssessmentCompleted":
    case "QuickApplyStarted":
      return "Lead";
    default:
      return event;
  }
}

export function isMetaFunnelEvent(value: string): value is MetaFunnelEvent {
  return (META_FUNNEL_EVENTS as readonly string[]).includes(value);
}

/** Stable, URL-safe event id for Pixel ↔ CAPI dedupe (max 50 chars recommended by Meta). */
export function createMetaEventId(seed?: string): string {
  const base =
    seed && seed.trim()
      ? seed.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32)
      : Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 10)
      : Math.random().toString(36).slice(2, 12);
  return `vplc_${base}_${time}_${rand}`.slice(0, 50);
}
