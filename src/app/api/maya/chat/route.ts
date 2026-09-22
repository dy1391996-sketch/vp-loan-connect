import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MAYA_COOKIE, ownerFromToken } from "@/lib/maya/owner";
import { mayaEvent, withMayaRuntime } from "@/lib/maya/runtime";
import { assertSameOrigin, rateLimit, requestIpHash } from "@/lib/security/request";

const schema = z.object({
  text: z.string().min(1).max(4000),
  conversationId: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  const token = request.cookies.get(MAYA_COOKIE)?.value;
  const result = await withMayaRuntime(async ({ store }) => {
    const auth = await ownerFromToken(store, token);
    if (!auth) return null;
    const requested = request.nextUrl.searchParams.get("conversationId");
    const conversation = (requested ? store.getConversation(auth.owner.ownerId, requested) : undefined) ?? store.listConversations(auth.owner.ownerId)[0];
    if (!conversation) return { conversationId: null, messages: [] as Array<{ role: "owner" | "maya"; text: string }> };
    const messages = store.listMessages(auth.owner.ownerId, conversation.conversationId, 80).map((message) => ({
      role: message.role,
      text: message.text,
    }));
    return { conversationId: conversation.conversationId, messages };
  });
  if (!result) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  return NextResponse.json(result);
}

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
    const queryConversationId = request.nextUrl.searchParams.get("conversationId") ?? undefined;
    const conversationId = parsed.data.conversationId ?? (queryConversationId && z.string().uuid().safeParse(queryConversationId).success ? queryConversationId : undefined);
    const wantsStream =
      request.nextUrl.searchParams.get("stream") === "1" || (request.headers.get("accept") || "").includes("text/event-stream");

    if (!wantsStream) {
      const result = await withMayaRuntime(async ({ store, brain }) => {
        const auth = await ownerFromToken(store, token);
        if (!auth) return null;
        mayaEvent("chat_turn", { ownerId: auth.owner.ownerId, channel: "web" });
        return brain.respond({
          ownerId: auth.owner.ownerId,
          channel: "web",
          text: parsed.data.text,
          conversationId,
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
    }

    const encoder = new TextEncoder();
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (payload: unknown) => {
          if (cancelled) return;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };

        void (async () => {
          try {
            const result = await withMayaRuntime(async ({ store, brain }) => {
              const auth = await ownerFromToken(store, token);
              if (!auth) return null;
              mayaEvent("chat_turn_stream", { ownerId: auth.owner.ownerId, channel: "web" });
              const abort = new AbortController();
              request.signal.addEventListener("abort", () => {
                cancelled = true;
                abort.abort();
              });
              return brain.respond(
                {
                  ownerId: auth.owner.ownerId,
                  channel: "web",
                  text: parsed.data.text,
                  conversationId,
                  ownerAuthorized: true,
                },
                {
                  signal: abort.signal,
                  onToken: (tokenText) => send({ type: "token", text: tokenText }),
                },
              );
            }, debugRequested);

            if (!result) {
              send({ type: "error", error: "Authentication required." });
              controller.close();
              return;
            }

            // Final grounded text (may differ from streamed raw tokens).
            send({
              type: "done",
              conversationId: result.conversationId,
              messageId: result.messageId,
              text: result.text,
              debug: debugRequested ? result.debug : undefined,
            });
            controller.close();
          } catch (error) {
            const name = error instanceof Error ? error.name : "";
            if (name === "AbortError" || cancelled) {
              send({ type: "error", error: "cancelled" });
              controller.close();
              return;
            }
            send({ type: "error", error: "Maya could not reply." });
            controller.close();
          }
        })();
      },
      cancel() {
        cancelled = true;
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      },
    });
  } catch {
    return NextResponse.json({ error: "Maya could not reply." }, { status: 500 });
  }
}
