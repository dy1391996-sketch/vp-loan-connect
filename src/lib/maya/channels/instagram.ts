import { createHmac, timingSafeEqual } from "node:crypto";
import { getMayaEnv, isInstagramOwner } from "../env";
import type { MayaBrain } from "../brain";

export interface InstagramInbound {
  senderId: string;
  text: string;
  mid?: string;
}

export function parseInstagramMessagingPayload(body: unknown): InstagramInbound[] {
  const payload = body as { entry?: Array<{ messaging?: Array<{ sender?: { id?: string }; message?: { text?: string; mid?: string } }> }> };
  const inbound: InstagramInbound[] = [];
  for (const entry of payload.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      const senderId = event.sender?.id;
      const text = event.message?.text?.trim();
      if (senderId && text) inbound.push({ senderId, text, mid: event.message?.mid });
    }
  }
  return inbound;
}

export async function handleInstagramMessage(brain: MayaBrain, inbound: InstagramInbound, ownerId: string) {
  const authorized = isInstagramOwner(inbound.senderId);
  return brain.respond({
    ownerId,
    channel: "instagram",
    text: inbound.text,
    ownerAuthorized: authorized,
    senderId: inbound.senderId,
  });
}

export function verifyInstagramWebhook(mode: string | null, token: string | null, challenge: string | null) {
  const env = getMayaEnv();
  if (mode === "subscribe" && token && challenge && token === env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) return challenge;
  return null;
}

export function hasValidInstagramSignature(raw: string, header: string | null, secret = getMayaEnv().INSTAGRAM_APP_SECRET) {
  if (!secret || !header?.startsWith("sha256=")) return false;
  const supplied = header.slice(7);
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const suppliedBuffer = Buffer.from(supplied, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export async function sendInstagramReply(recipientId: string, text: string) {
  const env = getMayaEnv();
  if (!env.INSTAGRAM_PAGE_ACCESS_TOKEN) {
    return { sent: false, reason: "missing_credentials" as const };
  }
  const response = await fetch(`${env.INSTAGRAM_GRAPH_API_URL}/me/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.INSTAGRAM_PAGE_ACCESS_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return { sent: false, reason: "provider_rejected" as const };
  return { sent: true as const };
}
