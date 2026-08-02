"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input, Label } from "@/components/ui/primitives";

export function SimulateWhatsAppForm() {
  const router = useRouter();
  const [from, setFrom] = useState("9876543210");
  const [text, setText] = useState("Hi, 24 hour price for tomorrow?");
  const [name, setName] = useState("Demo Guest");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastReply, setLastReply] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/inbox/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from, text, profileName: name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Simulation failed");
      setLastReply(data.reply ?? "(AI paused / handover — no auto reply)");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border border-line bg-white/80 p-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <p className="font-display text-lg text-ink-950">Simulate inbound WhatsApp</p>
        <p className="text-xs text-ink-700/70">Sandbox only — runs the real AI booking pipeline without Meta.</p>
      </div>
      <div>
        <Label>Guest phone</Label>
        <Input value={from} onChange={(e) => setFrom(e.target.value)} />
      </div>
      <div>
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <Label>Message</Label>
        <Input value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      {error ? <p className="sm:col-span-2 text-sm text-rose-500">{error}</p> : null}
      {lastReply ? <p className="sm:col-span-2 rounded-xl bg-sand-100 p-3 text-sm text-ink-800">{lastReply}</p> : null}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Processing…" : "Send simulated message"}
        </Button>
      </div>
    </form>
  );
}
