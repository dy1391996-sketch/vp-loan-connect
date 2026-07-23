"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: React.FormEvent) { event.preventDefault(); setBusy(true); setError(""); try { const response = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); router.replace("/admin"); router.refresh(); } catch (err) { setError(err instanceof Error ? err.message : "Unable to sign in."); setBusy(false); } }
  return <form onSubmit={submit} className="rounded-3xl border border-line bg-white p-7 shadow-soft sm:p-9"><span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-100 text-brand-700"><LockKeyhole size={22} /></span><h1 className="mt-6 text-2xl font-bold tracking-[-0.03em] text-navy-950">Admin sign in</h1><p className="mt-2 text-sm leading-6 text-slate-600">Authorized VP Loan Connect team members only.</p><div className="mt-7 grid gap-5"><Field label="Email"><Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field><Field label="Password"><Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field></div>{error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p> : null}<Button type="submit" className="mt-6 w-full" disabled={busy}>{busy ? <Loader2 className="animate-spin" size={18} /> : null}Sign in securely</Button></form>;
}
