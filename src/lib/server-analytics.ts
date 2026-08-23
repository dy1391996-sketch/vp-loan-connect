import { prisma } from "@/lib/db";

const allowed = new Set([
  "homepage_visit",
  "landing_view",
  "assessment_started",
  "quick_apply_started",
  "mobile_otp_sent",
  "mobile_verified",
  "email_otp_sent",
  "otp_requested",
  "email_verified",
  "otp_verified",
  "booster_offer_viewed",
  "booster_checkout_started",
  "assessment_completed",
  "free_result_viewed",
  "result_viewed",
  "matched_options_viewed",
  "checkout_opened",
  "checkout_resumed",
  "payment_order_created",
  "cashfree_checkout_opened",
  "payment_completed",
  "payment_success",
  "payment_pending",
  "payment_failed",
  "post_payment_assessment_started",
  "report_downloaded",
  "referral_link_copied",
  "referral_link_shared",
  "consultation_requested",
  "attribution_captured",
  "instagram_profile_click",
  "instagram_ad_landing",
  "partner_handoff_click",
  "partner_link_clicked",
]);

export async function trackServerEvent(eventName: string, input: { leadId?: string; sessionId?: string; page?: string; source?: string; properties?: Record<string, string | number | boolean | null> }) {
  if (!allowed.has(eventName)) throw new Error("Unsupported analytics event.");
  return prisma.analyticsEvent.create({ data: { eventName, ...input } });
}
