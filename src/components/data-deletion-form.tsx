"use client";

import { useState } from "react";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { StatusNotice } from "@/components/ui/status-notice";

type Feedback = { tone: "success" | "error" | "info"; message: string } | null;

export function DataDeletionForm() {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [requestId, setRequestId] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);

  async function requestOtp() {
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/otp/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fullName: name, mobile, source: "data_deletion" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to send OTP.");
      setRequestId(data.requestId);
      setFeedback({ tone: "info", message: data.developmentCode ? `Development OTP: ${data.developmentCode}` : "OTP sent to your verified mobile number." });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Unable to send OTP." });
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId, mobile, code }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to verify mobile.");
      setToken(data.verificationToken);
      setFeedback({ tone: "success", message: "Mobile verified. You can now submit the deletion request." });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Unable to verify mobile." });
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/data-deletion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ verificationToken: token, mobile, reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to record your request.");
      setFeedback({ tone: "success", message: `Request recorded. Reference: ${data.requestId}` });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Unable to record your request." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-7 rounded-[2rem] border border-line/80 bg-white p-6 shadow-card sm:p-8">
      <div className="flex items-start gap-4 border-b border-line pb-6">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-700"><ShieldCheck size={20} /></span>
        <div><h3 className="font-extrabold text-navy-950">Verify your registered mobile</h3><p className="mt-1 text-xs leading-5 text-slate-500">Verification helps prevent unauthorized deletion requests.</p></div>
      </div>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field label="Full name" required>
          <Input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <Field label="Verified mobile" required>
          <div className="flex flex-col gap-2 min-[420px]:flex-row">
            <Input className="number-field" inputMode="numeric" autoComplete="tel" value={mobile} onChange={(event) => setMobile(event.target.value.replace(/\D/g, "").slice(0, 10))} maxLength={10} required disabled={Boolean(token)} />
            <Button type="button" variant="secondary" className="shrink-0" onClick={requestOtp} disabled={busy || Boolean(token)}>
              {token ? <Check size={17} /> : null}{token ? "Verified" : requestId ? "Resend OTP" : "Send OTP"}
            </Button>
          </div>
        </Field>
        {requestId && !token ? (
          <Field label="6-digit OTP" required>
            <div className="flex flex-col gap-2 min-[420px]:flex-row">
              <Input className="number-field" inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} />
              <Button type="button" className="shrink-0" onClick={verifyOtp} disabled={busy || code.length !== 6}>
                {busy ? <Loader2 className="animate-spin" size={17} /> : null}Verify
              </Button>
            </div>
          </Field>
        ) : null}
        <div className="sm:col-span-2">
          <Field label="Reason (optional)" hint={`${reason.length}/1000 characters`}>
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} placeholder="Add any context that may help us process your request." />
          </Field>
        </div>
      </div>
      {feedback ? <StatusNotice tone={feedback.tone} className="mt-5">{feedback.message}</StatusNotice> : null}
      <Button type="submit" size="lg" className="mt-6 w-full" disabled={busy || !token}>
        {busy ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
        {busy ? "Submitting request…" : "Submit deletion request"}
      </Button>
    </form>
  );
}
