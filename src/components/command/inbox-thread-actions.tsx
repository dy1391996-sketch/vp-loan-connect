"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, Textarea } from "@/components/ui/primitives";

type Message = {
  id: string;
  direction: string;
  body: string | null;
  aiGenerated: boolean;
  createdAt: string | Date;
  intent?: string | null;
};

export function InboxThreadActions({
  conversationId,
  aiPaused,
  suggestion,
  messages,
}: {
  conversationId: string;
  aiPaused: boolean;
  suggestion: string;
  messages: Message[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(suggestion || "");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [messages],
  );

  async function run(label: string, fn: () => Promise<void>) {
    setLoading(label);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="max-h-[50vh] space-y-2 overflow-y-auto rounded-2xl border border-line bg-white/70 p-3">
        {sorted.map((m) => (
          <div
            key={m.id}
            className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
              m.direction === "INBOUND" ? "bg-sand-100 text-ink-900" : "ml-auto bg-ink-900 text-sand-50"
            }`}
          >
            <p className="whitespace-pre-wrap">{m.body}</p>
            <p className={`mt-1 text-[10px] ${m.direction === "INBOUND" ? "text-ink-700/60" : "text-sand-200/70"}`}>
              {m.direction}
              {m.aiGenerated ? " · AI" : ""}
              {m.intent ? ` · ${m.intent}` : ""}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={aiPaused ? "primary" : "secondary"}
          disabled={!!loading}
          onClick={() =>
            run("ai", async () => {
              const res = await fetch(`/api/admin/inbox/${conversationId}/ai`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ action: aiPaused ? "resume" : "pause" }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || "Failed");
            })
          }
        >
          {aiPaused ? "Resume AI" : "Pause AI"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!!loading}
          onClick={() =>
            run("handover", async () => {
              const res = await fetch(`/api/admin/inbox/${conversationId}/ai`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ action: "handover", pendingAction: "Staff takeover" }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || "Failed");
            })
          }
        >
          Human handover
        </Button>
        <Button size="sm" variant="ghost" type="button" onClick={() => setDraft(suggestion)}>
          Use AI suggestion
        </Button>
      </div>

      <div>
        <Textarea rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type or edit reply…" />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            disabled={!!loading || !draft.trim()}
            onClick={() =>
              run("send", async () => {
                const res = await fetch(`/api/admin/inbox/${conversationId}/messages`, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ body: draft, pauseAi: true }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Send failed");
                setDraft("");
              })
            }
          >
            {loading === "send" ? "Sending…" : "Send reply"}
          </Button>
        </div>
      </div>

      <div>
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal note…" />
        <Button
          className="mt-2"
          size="sm"
          variant="secondary"
          disabled={!!loading || !note.trim()}
          onClick={() =>
            run("note", async () => {
              const res = await fetch(`/api/admin/inbox/${conversationId}/notes`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ body: note }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || "Note failed");
              setNote("");
            })
          }
        >
          Add note
        </Button>
      </div>

      {error ? <p className="text-sm text-rose-500">{error}</p> : null}
    </div>
  );
}
