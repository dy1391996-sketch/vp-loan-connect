import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { verifyMetaSignature } from "@/lib/security/signatures";
import { routeError } from "@/lib/api/route-helpers";
import { sha256 } from "@/lib/utils";
import { parseWhatsAppWebhookPayload, processWhatsAppInboundMessage } from "@/lib/whatsapp/inbound";
import { parseInstagramCommentPayload, parseInstagramMessagingPayload } from "@/lib/instagram/parse";
import { processInstagramCommentEvent, processInstagramDmEvent } from "@/lib/instagram/inbound";

const metaWebhookSchema = z
  .object({
    object: z.string().optional(),
    entry: z.array(z.unknown()).optional(),
  })
  .passthrough();

function metaIdempotencyKey(payload: z.infer<typeof metaWebhookSchema>, rawBody: string) {
  const firstEntry = Array.isArray(payload.entry)
    ? (payload.entry[0] as {
        id?: string;
        changes?: unknown[];
        messaging?: Array<{ message?: { mid?: string } }>;
      } | undefined)
    : undefined;
  const firstChange = Array.isArray(firstEntry?.changes)
    ? (firstEntry?.changes[0] as {
        value?: {
          messages?: { id?: string }[];
          statuses?: { id?: string }[];
          id?: string;
        };
      })
    : undefined;
  const messageId =
    firstChange?.value?.messages?.[0]?.id ??
    firstChange?.value?.statuses?.[0]?.id ??
    firstChange?.value?.id ??
    firstEntry?.messaging?.[0]?.message?.mid;
  return `meta:${payload.object ?? "event"}:${firstEntry?.id ?? "entry"}:${messageId ?? sha256(rawBody)}`;
}

function verifyTokenMatches(token: string | null) {
  const env = getServerEnv();
  const expected = env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN || "";
  return Boolean(token && expected && token === expected);
}

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (mode === "subscribe" && verifyTokenMatches(token) && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Invalid verification token." }, { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const env = getServerEnv();
    const appSecret = env.WHATSAPP_APP_SECRET || process.env.META_APP_SECRET || "";
    const hasSecret = Boolean(appSecret);
    const sandboxAllowed =
      env.NODE_ENV !== "production" || env.WHATSAPP_PROVIDER === "mock" || env.INSTAGRAM_PROVIDER === "mock";
    if (hasSecret && !verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
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

    const results: unknown[] = [];

    if (payload.object === "whatsapp_business_account" || !payload.object) {
      const messages = parseWhatsAppWebhookPayload(payload);
      for (const msg of messages) {
        results.push(await processWhatsAppInboundMessage(msg));
      }
    }

    if (payload.object === "instagram" || payload.object === "page") {
      const dmEvents = parseInstagramMessagingPayload(payload);
      for (const dm of dmEvents) {
        results.push(await processInstagramDmEvent(dm));
      }
      const commentEvents = parseInstagramCommentPayload(payload);
      for (const comment of commentEvents) {
        results.push(await processInstagramCommentEvent(comment));
      }
      // Also handle page-subscribed Instagram messaging nested under entry.messaging without object=instagram
      if (!dmEvents.length && !commentEvents.length) {
        results.push({ note: "meta_page_event_recorded_no_ig_messages" });
      }
    }

    // Some IG messaging apps send object=instagram with messaging arrays — already handled.
    // Fallback: if messaging present on any object
    if (payload.object && payload.object !== "instagram" && payload.object !== "page" && payload.object !== "whatsapp_business_account") {
      const dmEvents = parseInstagramMessagingPayload(payload);
      for (const dm of dmEvents) results.push(await processInstagramDmEvent(dm));
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
