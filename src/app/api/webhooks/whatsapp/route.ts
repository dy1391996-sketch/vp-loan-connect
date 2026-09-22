import { hasValidMetaSignature } from "@/lib/meta/whatsapp-signature";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { CONSENT_VERSION, MARKETING_CONSENT_TEXT } from "@/lib/constants";
import { getServerEnv } from "@/lib/env";
import { sendWhatsAppTemplate } from "@/lib/providers/whatsapp";

type WhatsAppPayload = { entry?: Array<{ changes?: Array<{ value?: { messages?: Array<{ from?: string; text?: { body?: string } }> } }> }> };

export async function GET(request: NextRequest) {
  const env = getServerEnv();
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN && challenge) return new NextResponse(challenge);
  return NextResponse.json({ error: "Verification failed." }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const env = getServerEnv();
  // Always require a valid Meta signature whenever an app secret is configured.
  // Never accept unauthenticated STOP webhooks in production.
  if (env.WHATSAPP_APP_SECRET) {
    if (!hasValidMetaSignature(raw, request.headers.get("x-hub-signature-256"), env.WHATSAPP_APP_SECRET)) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }
  } else if (env.NODE_ENV === "production") {
    return NextResponse.json({ error: "WhatsApp webhook is not configured." }, { status: 503 });
  }

  let body: WhatsAppPayload;
  try {
    body = JSON.parse(raw) as WhatsAppPayload;
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const messages = body.entry?.flatMap((entry) => entry.changes?.flatMap((change) => change.value?.messages ?? []) ?? []) ?? [];
  for (const message of messages) {
    if (message.text?.body?.trim().toUpperCase() !== "STOP" || !message.from) continue;
    const digits = message.from.replace(/\D/g, "");
    const mobile = digits.startsWith("91") ? `+${digits}` : `+91${digits}`;
    const lead = await prisma.lead.findUnique({ where: { mobile }, include: { consentLogs: { where: { consentType: "MARKETING", accepted: true, withdrawnAt: null }, orderBy: { createdAt: "desc" }, take: 1 } } });
    if (!lead || lead.marketingOptedOutAt) continue;

    const now = new Date();
    await prisma.$transaction([
      prisma.lead.update({ where: { id: lead.id }, data: { marketingOptedOutAt: now, stage: "OPTED_OUT" } }),
      ...(lead.consentLogs[0] ? [prisma.consentLog.update({ where: { consentId: lead.consentLogs[0].consentId }, data: { withdrawnAt: now } })] : []),
      prisma.consentLog.create({ data: { leadId: lead.id, consentType: "MARKETING", consentText: MARKETING_CONSENT_TEXT, consentVersion: CONSENT_VERSION, accepted: false, withdrawnAt: now, source: "whatsapp_stop" } }),
      prisma.communicationLog.create({ data: { leadId: lead.id, channel: "WHATSAPP", direction: "INBOUND", purpose: "marketing_opt_out", messagePreview: "STOP", status: "DELIVERED" } }),
    ]);
    await sendWhatsAppTemplate(lead.id, "OPT_OUT_CONFIRMATION", {});
  }
  return NextResponse.json({ received: true });
}

