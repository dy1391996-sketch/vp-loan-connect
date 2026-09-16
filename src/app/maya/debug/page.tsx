"use client";

import { useState } from "react";
import Link from "next/link";

export default function MayaDebugPage() {
  const [query, setQuery] = useState("business");
  const [payload, setPayload] = useState("");

  async function run() {
    const response = await fetch(`/api/maya/debug?q=${encodeURIComponent(query)}`);
    setPayload(JSON.stringify(await response.json(), null, 2));
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/maya" className="text-sm text-[#e7b7c8]">
        ← Chat
      </Link>
      <h1 className="mt-3 font-display text-3xl">Debug inspector</h1>
      <p className="mt-2 text-sm text-[#d7c4c8]">Development only. Hidden from Maya chat and production.</p>
      <div className="mt-6 flex gap-2">
        <input className="flex-1 rounded-2xl border border-[#3a2a31] bg-[#1b1216] px-4 py-3" value={query} onChange={(event) => setQuery(event.target.value)} />
        <button className="rounded-2xl bg-[#e7b7c8] px-4 py-3 text-[#1b1216]" type="button" onClick={() => void run()}>
          Inspect
        </button>
      </div>
      <pre className="mt-6 overflow-auto rounded-2xl bg-[#1b1216] p-4 text-xs">{payload || "No query yet."}</pre>
    </section>
  );
}
