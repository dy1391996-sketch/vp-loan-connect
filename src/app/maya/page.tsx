"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";

type ChatItem = { role: "owner" | "maya"; text: string };

export default function MayaChatPage() {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [text, setText] = useState("");
  const [conversationId, setConversationId] = useState<string>();
  const [pending, setPending] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

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
      setItems(history.length ? history : [{ role: "maya", text: "Hey. I'm here." }]);
    })();
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [items, pending]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setText("");
    setItems((current) => [...current, { role: "owner", text: trimmed }]);
    setPending(true);
    const response = await fetch("/api/maya/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: trimmed, conversationId }),
    });
    setPending(false);
    if (!response.ok) {
      setItems((current) => [...current, { role: "maya", text: "That didn't go through. Try again in a second." }]);
      return;
    }
    const data = (await response.json()) as { text: string; conversationId: string };
    setConversationId(data.conversationId);
    window.sessionStorage.setItem("mayaConversationId", data.conversationId);
    setItems((current) => [...current, { role: "maya", text: data.text }]);
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
        {pending ? <p className="text-sm text-[#d7c4c8]">…</p> : null}
      </div>
      <form onSubmit={onSubmit} className="shrink-0 border-t border-[#3a2a31] bg-[#120b10] p-4">
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Bol…"
            className="flex-1 rounded-2xl border border-[#3a2a31] bg-[#1b1216] px-4 py-3"
          />
          <button className="rounded-2xl bg-[#e7b7c8] px-5 py-3 font-semibold text-[#1b1216]" disabled={pending} type="submit">
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
