import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { verifyMetaSignature } from "@/lib/security/signatures";
import { routeError } from "@/lib/api/route-helpers";
import { sha256 } from "@/lib/utils";
import { parseWhatsAppWebhookPayload, processWhatsAppInboundMessage } from "@/lib/whatsapp/inbound";

const metaWebhookSchema = z
  .object({
    object: z.string().optional(),
    entry: z.array(z.unknown()).optional(),
  })
  .passthrough();

function metaIdempotencyKey(payload: z.infer<typeof metaWebhookSchema>, rawBody: string) {
  const firstEntry = Array.isArray(payload.entry)
    ? (payload.entry[0] as { id?: string; changes?: unknown[] } | undefined)
    : undefined;
  const firstChange = Array.isArray(firstEntry?.changes)
    ? (firstEntry?.changes[0] as { value?: { messages?: { id?: string }[]; statuses?: { id?: string }[] } })
    : undefined;
  const messageId = firstChange?.value?.messages?.[0]?.id ?? firstChange?.value?.statuses?.[0]?.id;
  return `meta:${payload.object ?? "event"}:${firstEntry?.id ?? "entry"}:${messageId ?? sha256(rawBody)}`;
}

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  const env = getServerEnv();
  if (mode === "subscribe" && token && token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Invalid verification token." }, { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const env = getServerEnv();
    const hasSecret = Boolean(env.WHATSAPP_APP_SECRET);
    const sandboxAllowed = env.NODE_ENV !== "production" || env.WHATSAPP_PROVIDER === "mock";
    if (hasSecret && !verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"), env.WHATSAPP_APP_SECRET)) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }
    if (!hasSecret && !sandboxAllowed) {
      return NextResponse.json({ error: "Webhook secret is not configured." }, { status: 401 });
    }

    const payload = metaWebhookSchema.parse(JSON.parse(rawBody));
    const idempotencyKey = metaIdempotencyKey(payload, rawBody);
    const existing = await prisma.webhookEvent.findUnique({ where: { idempotencyKey } });
    if (existing) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const event = await prisma.webhookEvent.create({
      data: {
        provider: "META",
        eventType: payload.object ?? "meta.event",
        idempotencyKey,
        payload: payload as object,
        status: "RECEIVED",
      },
    });

    const results = [];
    // WhatsApp Cloud API payloads
    if (payload.object === "whatsapp_business_account" || !payload.object) {
      const messages = parseWhatsAppWebhookPayload(payload);
      for (const msg of messages) {
        results.push(await processWhatsAppInboundMessage(msg));
      }
    }

    // Instagram messaging stubs (Phase 3 deepens this) — still persist inbound if present
    if (payload.object === "instagram" || payload.object === "page") {
      results.push({ note: "instagram_event_recorded", phase: 3 });
    }

    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { status: "PROCESSED", processedAt: new Date() },
    });

    return NextResponse.json({ ok: true, id: event.id, results });
  } catch (error) {
    return routeError(error);
  }
}
