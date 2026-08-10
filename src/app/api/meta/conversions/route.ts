import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, rateLimit, requestIpHash } from "@/lib/security/request";
import { META_FUNNEL_EVENTS, isMetaFunnelEvent } from "@/lib/meta/events";
import { getMetaCapiConfig, sendMetaCapiEvent } from "@/lib/meta/capi";

const schema = z.object({
  eventName: z.enum(META_FUNNEL_EVENTS),
  eventId: z.string().min(8).max(50),
  eventSourceUrl: z.string().url().max(2000).optional(),
  customData: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  fbp: z.string().max(200).optional(),
  fbc: z.string().max(200).optional(),
});

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ accepted: false }, { status: 403 });
  }

  const ipHash = requestIpHash(request) ?? "unknown";
  if (!rateLimit(`meta-capi-ip:${ipHash}`, 40, 60 * 1000).allowed) {
    return NextResponse.json({ accepted: false }, { status: 429 });
  }

  // Missing Meta config must not break the site — accept and no-op.
  if (!getMetaCapiConfig()) {
    return NextResponse.json({ accepted: true, sent: false, reason: "not_configured" }, { status: 202 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ accepted: false }, { status: 400 });
  if (!isMetaFunnelEvent(parsed.data.eventName)) {
    return NextResponse.json({ accepted: false }, { status: 400 });
  }

  const result = await sendMetaCapiEvent({
    eventName: parsed.data.eventName,
    eventId: parsed.data.eventId,
    eventSourceUrl: parsed.data.eventSourceUrl ?? request.headers.get("referer"),
    customData: parsed.data.customData,
    userData: {
      clientIpAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      clientUserAgent: request.headers.get("user-agent"),
      fbp: parsed.data.fbp,
      fbc: parsed.data.fbc,
    },
  });

  return NextResponse.json({ accepted: true, ...result }, { status: 202 });
}
