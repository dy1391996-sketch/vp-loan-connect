"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function MayaLoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/maya";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const response = await fetch("/api/maya/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setPending(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (response.status === 401) setError(payload?.error || "Invalid email or password.");
      else if (response.status === 403) setError(payload?.error || "Invalid request origin.");
      else if (response.status === 429) setError(payload?.error || "Too many login attempts.");
      else if (response.status === 503) setError(payload?.error || "Owner authentication is not configured.");
      else setError(payload?.error || "Unable to sign in.");
      return;
    }
    router.replace(next.startsWith("/maya") ? next : "/maya");
  }

  return (
    <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <p className="text-sm tracking-[0.2em] text-[#e7b7c8]">PRIVATE</p>
      <h1 className="mt-3 font-display text-4xl">Maya</h1>
      <p className="mt-2 text-[#d7c4c8]">Owner access only. This is not part of the public site.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block text-sm">
          Email
          <input className="mt-1 w-full rounded-2xl border border-[#3a2a31] bg-[#1b1216] px-4 py-3" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="block text-sm">
          Password
          <input className="mt-1 w-full rounded-2xl border border-[#3a2a31] bg-[#1b1216] px-4 py-3" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} required />
        </label>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <button className="w-full rounded-2xl bg-[#e7b7c8] px-4 py-3 font-semibold text-[#1b1216]" disabled={pending} type="submit">
          {pending ? "Opening…" : "Enter"}
        </button>
      </form>
    </section>
  );
}

export default function MayaLoginPage() {
  return (
    <Suspense fallback={<p className="p-8">Loading…</p>}>
      <MayaLoginForm />
    </Suspense>
  );
}
