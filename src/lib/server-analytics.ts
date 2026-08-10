import { prisma } from "@/lib/db";

const allowed = new Set([
  "homepage_visit",
  "assessment_started",
  "mobile_otp_sent",
  "mobile_verified",
  "email_otp_sent",
  "email_verified",
  "assessment_completed",
  "free_result_viewed",
  "checkout_opened",
  "checkout_resumed",
  "payment_completed",
  "report_downloaded",
  "referral_link_copied",
  "referral_link_shared",
  "consultation_requested",
  "attribution_captured",
  "instagram_profile_click",
  "instagram_ad_landing",
  "partner_handoff_click",
]);

export async function trackServerEvent(eventName: string, input: { leadId?: string; sessionId?: string; page?: string; source?: string; properties?: Record<string, string | number | boolean | null> }) {
  if (!allowed.has(eventName)) throw new Error("Unsupported analytics event.");
  return prisma.analyticsEvent.create({ data: { eventName, ...input } });
}
