import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertSameOrigin, rateLimit, requestIpHash } from "@/lib/security/request";

const allowed = [
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
] as const;

const schema = z.object({
  eventName: z.enum(allowed),
  leadId: z.string().uuid().optional(),
  sessionId: z.string().max(100).optional(),
  page: z.string().max(300).optional(),
  source: z.string().max(120).optional(),
  properties: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ accepted: false }, { status: 403 });
  }

  const ipHash = requestIpHash(request) ?? "unknown";
  if (!rateLimit(`analytics-ip:${ipHash}`, 60, 60 * 1000).allowed) {
    return NextResponse.json({ accepted: false }, { status: 429 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ accepted: false }, { status: 400 });
  try {
    await prisma.analyticsEvent.create({ data: parsed.data });
  } catch (error) {
    console.error("analytics_event_failed", error instanceof Error ? error.message : "unknown");
  }
  return NextResponse.json({ accepted: true }, { status: 202 });
}
