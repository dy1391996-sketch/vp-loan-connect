"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BRAND } from "@/lib/constants";
import { Button, Card, Input, Label } from "@/components/ui/primitives";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      router.push(params.get("next") || "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-copper-500/20 blur-3xl animate-pulse-soft" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-teal-500/15 blur-3xl" />
      </div>
      <Card className="relative w-full max-w-md p-6 sm:p-8 animate-fade-up">
        <p className="font-display text-3xl text-ink-950">{BRAND.name}</p>
        <p className="mt-1 text-sm text-ink-700/75">{BRAND.tagline} · AI Command Center</p>
        <form className="mt-8 space-y-4" onSubmit={onSubmit}>
          <div>
            <Label>Email</Label>
            <Input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Password</Label>
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-rose-500">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
