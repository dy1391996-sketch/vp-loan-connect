import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MAYA_COOKIE, ownerFromToken } from "@/lib/maya/owner";
import { mayaEvent, withMayaRuntime } from "@/lib/maya/runtime";
import { assertSameOrigin, rateLimit, requestIpHash } from "@/lib/security/request";

const schema = z.object({
  text: z.string().min(1).max(4000),
  conversationId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const ipHash = requestIpHash(request) ?? "unknown";
    if (!rateLimit(`maya-chat:${ipHash}`, 40, 10 * 60 * 1000).allowed) {
      return NextResponse.json({ error: "Slow down a little." }, { status: 429 });
    }
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid message." }, { status: 400 });
    const token = request.cookies.get(MAYA_COOKIE)?.value;
    const debugRequested = request.nextUrl.searchParams.get("debug") === "1" && process.env.NODE_ENV !== "production";
    const result = await withMayaRuntime(async ({ store, brain }) => {
      const auth = await ownerFromToken(store, token);
      if (!auth) return null;
      mayaEvent("chat_turn", { ownerId: auth.owner.ownerId, channel: "web" });
      return brain.respond({
        ownerId: auth.owner.ownerId,
        channel: "web",
        text: parsed.data.text,
        conversationId: parsed.data.conversationId,
        ownerAuthorized: true,
      });
    }, debugRequested);
    if (!result) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    return NextResponse.json({
      conversationId: result.conversationId,
      messageId: result.messageId,
      text: result.text,
      debug: debugRequested ? result.debug : undefined,
    });
  } catch {
    return NextResponse.json({ error: "Maya could not reply." }, { status: 500 });
  }
}
