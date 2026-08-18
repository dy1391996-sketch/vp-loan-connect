"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";

export function HandoffLinkButton({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [ref, setRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function create() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/handoff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setUrl(data.absoluteUrl);
      setRef(data.publicRef);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button size="sm" variant="secondary" disabled={loading} onClick={create}>
        {loading ? "Creating…" : "Create WhatsApp handoff link"}
      </Button>
      {url ? (
        <p className="break-all text-xs text-ink-700">
          Ref {ref}: <a className="text-copper-600 underline" href={url}>{url}</a>
        </p>
      ) : null}
      {error ? <p className="text-xs text-rose-500">{error}</p> : null}
    </div>
  );
}
