"use client";

import MayaVoiceControls from "@/components/maya/MayaVoiceControls";
import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";

type ChatItem = { role: "owner" | "maya"; text: string };

function rememberLastMaya(history: ChatItem[]) {
  const lastMaya = [...history].reverse().find((message) => message.role === "maya");
  if (lastMaya) window.sessionStorage.setItem("mayaLastAssistantText", lastMaya.text);
}

export default function MayaChatPage() {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [text, setText] = useState("");
  const [conversationId, setConversationId] = useState<string>();
  const [pending, setPending] = useState(false);
  const [voicePending, setVoicePending] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const busy = pending || voicePending;

  useEffect(() => {
    void (async () => {
      const saved = window.sessionStorage.getItem("mayaConversationId") ?? "";
      const response = await fetch(`/api/maya/chat${saved ? `?conversationId=${saved}` : ""}`);
      if (!response.ok) return;
      const data = (await response.json()) as { conversationId: string | null; messages: ChatItem[] };
      if (data.conversationId) {
        setConversationId(data.conversationId);
        window.sessionStorage.setItem("mayaConversationId", data.conversationId);
      }
      const history = data.messages.filter((message) => message.role === "owner" || message.role === "maya");
      const shown = history.length ? history : [{ role: "maya" as const, text: "Hey. I'm here." }];
      setItems(shown);
      rememberLastMaya(shown);
    })();
  }, []);

  useEffect(() => {
    const syncHistory = () => {
      const saved = window.sessionStorage.getItem("mayaConversationId") ?? "";
      void (async () => {
        const response = await fetch(`/api/maya/chat${saved ? `?conversationId=${saved}` : ""}`);
        if (!response.ok) return;
        const data = (await response.json()) as { conversationId: string | null; messages: ChatItem[] };
        if (data.conversationId) {
          setConversationId(data.conversationId);
          window.sessionStorage.setItem("mayaConversationId", data.conversationId);
        }
        const history = data.messages.filter((message) => message.role === "owner" || message.role === "maya");
        if (history.length) {
          setItems(history);
          rememberLastMaya(history);
        }
      })();
    };

    const onVoicePending = (event: Event) => {
      const detail = (event as CustomEvent<{ pending?: boolean }>).detail;
      setVoicePending(Boolean(detail?.pending));
    };

    window.addEventListener("maya:conversation-updated", syncHistory);
    window.addEventListener("maya:voice-pending", onVoicePending);
    return () => {
      window.removeEventListener("maya:conversation-updated", syncHistory);
      window.removeEventListener("maya:voice-pending", onVoicePending);
    };
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [items, busy]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setText("");
    setItems((current) => [...current, { role: "owner", text: trimmed }, { role: "maya", text: "" }]);
    setPending(true);
    const controller = new AbortController();
    const firstVisible = { at: 0 };

    try {
      const response = await fetch("/api/maya/chat?stream=1", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream",
        },
        body: JSON.stringify({ text: trimmed, conversationId }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        setItems((current) => {
          const next = [...current];
          next[next.length - 1] = { role: "maya", text: "That didn't go through. Try again in a second." };
          return next;
        });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamed = "";
      let finalText = "";
      let finalConversationId = conversationId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const line = chunk
            .split("\n")
            .map((part) => part.trim())
            .find((part) => part.startsWith("data:"));
          if (!line) continue;
          let payload: { type?: string; text?: string; conversationId?: string; error?: string };
          try {
            payload = JSON.parse(line.slice(5).trim()) as typeof payload;
          } catch {
            continue;
          }
          if (payload.type === "token" && typeof payload.text === "string") {
            if (!firstVisible.at) firstVisible.at = Date.now();
            streamed += payload.text;
            const visible = streamed;
            setItems((current) => {
              const next = [...current];
              next[next.length - 1] = { role: "maya", text: visible };
              return next;
            });
          } else if (payload.type === "done") {
            finalText = typeof payload.text === "string" ? payload.text : streamed;
            finalConversationId = payload.conversationId || finalConversationId;
          } else if (payload.type === "error") {
            throw new Error(payload.error || "stream-error");
          }
        }
      }

      if (finalConversationId) {
        setConversationId(finalConversationId);
        window.sessionStorage.setItem("mayaConversationId", finalConversationId);
      }
      const grounded = finalText || streamed || "That didn't go through. Try again in a second.";
      setItems((current) => {
        const next = [...current];
        next[next.length - 1] = { role: "maya", text: grounded };
        rememberLastMaya(next);
        return next;
      });
    } catch {
      setItems((current) => {
        const next = [...current];
        const last = next[next.length - 1];
        if (last?.role === "maya" && !last.text) {
          next[next.length - 1] = { role: "maya", text: "That didn't go through. Try again in a second." };
        }
        return next;
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-[#3a2a31] px-4 py-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/api/maya/visual" alt="Maya" className="h-12 w-12 rounded-full object-cover" />
        <div>
          <p className="font-display text-lg">Maya</p>
          <p className="text-xs text-[#d7c4c8]">Private companion</p>
        </div>
        <div className="ml-auto flex gap-3 text-sm text-[#e7b7c8]">
          <Link href="/maya/media">Media</Link>
          <Link href="/maya/memory">Memory</Link>
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/maya/logout", { method: "POST" });
              window.sessionStorage.removeItem("mayaConversationId");
              window.location.href = "/maya/login";
            }}
          >
            Leave
          </button>
        </div>
      </header>
      <div ref={scroller} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-6">
        {items.map((item, index) => (
          <div key={`${item.role}-${index}`} className={item.role === "owner" ? "ml-auto max-w-[80%] rounded-3xl bg-[#3a2a31] px-4 py-3" : "max-w-[80%] rounded-3xl bg-[#241820] px-4 py-3"}>
            <p className="whitespace-pre-wrap leading-relaxed">{item.text}</p>
          </div>
        ))}
        {busy ? <p className="text-sm text-[#d7c4c8]">…</p> : null}
      </div>
      <form onSubmit={onSubmit} className="shrink-0 border-t border-[#3a2a31] bg-[#120b10] p-4">
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Bol…"
            disabled={busy}
            className="flex-1 rounded-2xl border border-[#3a2a31] bg-[#1b1216] px-4 py-3 disabled:opacity-60"
          />
          <button className="rounded-2xl bg-[#e7b7c8] px-5 py-3 font-semibold text-[#1b1216]" disabled={busy} type="submit">
            Send
          </button>
        </div>
        <MayaVoiceControls disabled={pending} />
      </form>
    </div>
  );
}
