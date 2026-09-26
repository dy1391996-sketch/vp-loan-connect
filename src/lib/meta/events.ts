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
  "PaymentFailed",
  "Purchase",
  "InstagramProfileClick",
  "InstagramAdLanding",
  "LoanAssistanceEnquiry",
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
  // Pixel/CAPI standard name is Purchase; funnel label PaymentSuccess is kept in custom_data.
  payment_completed: ["PaymentSuccess"],
  payment_failed: ["PaymentFailed"],
  instagram_profile_click: ["InstagramProfileClick"],
};

/**
 * Browser Pixel method must match the name sent to Conversions API.
 * Non-standard names use trackCustom so they are not rejected or collapsed.
 */
const STANDARD_META_PIXEL_EVENTS = new Set([
  "PageView",
  "ViewContent",
  "Search",
  "AddToCart",
  "AddToWishlist",
  "InitiateCheckout",
  "AddPaymentInfo",
  "Purchase",
  "Lead",
  "CompleteRegistration",
  "Contact",
  "CustomizeProduct",
  "Donate",
  "FindLocation",
  "Schedule",
  "StartTrial",
  "SubmitApplication",
  "Subscribe",
]);

/** One standard Meta name per stage. Do not map several stages onto Lead. */
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
      return "CompleteRegistration";
    case "AssessmentCompleted":
      return "SubmitApplication";
    case "EligibilityViewed":
      return "ViewContent";
    case "LoanAssistanceEnquiry":
      return "Lead";
    default:
      return event;
  }
}

export function metaBrowserTrackMethod(eventName: string): "track" | "trackCustom" {
  return STANDARD_META_PIXEL_EVENTS.has(eventName) ? "track" : "trackCustom";
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
