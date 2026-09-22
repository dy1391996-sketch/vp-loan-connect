"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function MayaLoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/maya";
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function openMaya() {
    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/maya/login", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setError(payload?.error || "Unable to open Maya.");
        return;
      }

      router.replace(next.startsWith("/maya") ? next : "/maya");
      router.refresh();
    } catch {
      setError("Unable to open Maya.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <p className="text-sm tracking-[0.2em] text-[#e7b7c8]">
        PRIVATE
      </p>

      <h1 className="mt-3 font-display text-4xl">Maya</h1>

      <p className="mt-2 text-[#d7c4c8]">
        Your private Maya Life System.
      </p>

      <button
        type="button"
        onClick={openMaya}
        disabled={pending}
        className="mt-8 w-full rounded-2xl bg-[#e7b7c8] px-4 py-3 font-semibold text-[#1b1216] disabled:opacity-60"
      >
        {pending ? "Opening Maya…" : "Open Maya"}
      </button>

      {error ? (
        <p className="mt-4 text-sm text-red-300">{error}</p>
      ) : null}
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
