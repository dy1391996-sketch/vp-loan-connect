"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input, Label, Select } from "@/components/ui/primitives";

type SimKind = "whatsapp" | "instagram_dm" | "instagram_comment" | "whatsapp_handoff";

export function SimulateWhatsAppForm() {
  const router = useRouter();
  const [kind, setKind] = useState<SimKind>("whatsapp");
  const [from, setFrom] = useState("9876543210");
  const [igUserId, setIgUserId] = useState("ig_scoped_demo_1");
  const [text, setText] = useState("Hi, 24 hour price for tomorrow?");
  const [name, setName] = useState("Demo Guest");
  const [handoffRef, setHandoffRef] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/inbox/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          from,
          igUserId,
          text:
            kind === "whatsapp_handoff" && handoffRef
              ? `Hi, I'm continuing my Studio99Stay enquiry. Ref: ${handoffRef}`
              : text,
          profileName: name,
          username: name.replace(/\s+/g, "_").toLowerCase(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Simulation failed");
      const reply = data.reply ?? data.handoffUrl ?? data.category ?? JSON.stringify(data).slice(0, 240);
      setResult(typeof reply === "string" ? reply : JSON.stringify(reply));
      if (data.handoffUrl) setHandoffRef(String(data.handoffUrl).split("Ref: ").pop() ?? handoffRef);
      if (data.publicRef) setHandoffRef(data.publicRef);
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
        <p className="font-display text-lg text-ink-950">Sandbox channel simulator</p>
        <p className="text-xs text-ink-700/70">Development only — not proof of live Meta delivery.</p>
      </div>
      <div className="sm:col-span-2">
        <Label>Scenario</Label>
        <Select value={kind} onChange={(e) => setKind(e.target.value as SimKind)}>
          <option value="whatsapp">WhatsApp inbound</option>
          <option value="instagram_dm">Instagram DM</option>
          <option value="instagram_comment">Instagram comment</option>
          <option value="whatsapp_handoff">WhatsApp inbound with handoff Ref</option>
        </Select>
      </div>
      {(kind === "whatsapp" || kind === "whatsapp_handoff") && (
        <div>
          <Label>Guest phone</Label>
          <Input value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
      )}
      {(kind === "instagram_dm" || kind === "instagram_comment") && (
        <div>
          <Label>Instagram scoped user id</Label>
          <Input value={igUserId} onChange={(e) => setIgUserId(e.target.value)} />
        </div>
      )}
      <div>
        <Label>Name / username</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      {kind === "whatsapp_handoff" ? (
        <div className="sm:col-span-2">
          <Label>Handoff public Ref</Label>
          <Input value={handoffRef} onChange={(e) => setHandoffRef(e.target.value)} placeholder="ABCD1234" />
        </div>
      ) : (
        <div className="sm:col-span-2">
          <Label>Message / comment</Label>
          <Input value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      )}
      {error ? <p className="sm:col-span-2 text-sm text-rose-500">{error}</p> : null}
      {result ? <p className="sm:col-span-2 rounded-xl bg-sand-100 p-3 text-sm text-ink-800 whitespace-pre-wrap">{result}</p> : null}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Processing…" : "Run sandbox event"}
        </Button>
      </div>
    </form>
  );
}
