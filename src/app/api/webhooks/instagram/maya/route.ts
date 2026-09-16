import { NextRequest, NextResponse } from "next/server";
import { getMayaEnv } from "@/lib/maya/env";
import { handleInstagramMessage, hasValidInstagramSignature, parseInstagramMessagingPayload, sendInstagramReply, verifyInstagramWebhook } from "@/lib/maya/channels/instagram";
import { mayaEvent, withMayaRuntime } from "@/lib/maya/runtime";

export async function GET(request: NextRequest) {
  const challenge = verifyInstagramWebhook(
    request.nextUrl.searchParams.get("hub.mode"),
    request.nextUrl.searchParams.get("hub.verify_token"),
    request.nextUrl.searchParams.get("hub.challenge"),
  );
  if (challenge) return new NextResponse(challenge);
  return NextResponse.json({ error: "Verification failed." }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const env = getMayaEnv();
  if (env.INSTAGRAM_APP_SECRET) {
    if (!hasValidInstagramSignature(raw, request.headers.get("x-hub-signature-256"), env.INSTAGRAM_APP_SECRET)) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Instagram webhook is not configured." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const inbound = parseInstagramMessagingPayload(body);
  await withMayaRuntime(async ({ store, brain }) => {
    const owner = store.listOwners()[0];
    if (!owner) return;
    for (const message of inbound) {
      const turn = await handleInstagramMessage(brain, message, owner.ownerId);
      mayaEvent("instagram_inbound", { authorized: turn.ownerAuthorized, senderHashed: "redacted" });
      if (env.INSTAGRAM_PAGE_ACCESS_TOKEN) {
        await sendInstagramReply(message.senderId, turn.text);
      }
    }
  });
  return NextResponse.json({ received: true });
}
