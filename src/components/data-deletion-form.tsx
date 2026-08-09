"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { StatusNotice } from "@/components/ui/status-notice";
import {
  prepareMsg91EmailOtp,
  resetMsg91EmailOtpClient,
  retryMsg91EmailOtp,
  sendMsg91EmailOtp,
  verifyMsg91EmailOtp,
} from "@/lib/apply/msg91-email-otp";

type Feedback = { tone: "success" | "error" | "info"; message: string } | null;

const MSG91_WIDGET_ID = process.env.NEXT_PUBLIC_MSG91_WIDGET_ID ?? "";
const MSG91_WIDGET_TOKEN = process.env.NEXT_PUBLIC_MSG91_WIDGET_TOKEN ?? "";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function DataDeletionForm() {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpReqId, setOtpReqId] = useState("");
  const [otpReady, setOtpReady] = useState(false);
  const [otpStarted, setOtpStarted] = useState(false);
  const [token, setToken] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  function resetOtpState() {
    setToken("");
    setOtpStarted(false);
    setOtpCode("");
    setOtpReqId("");
    setResendIn(0);
    resetMsg91EmailOtpClient();
    setOtpReady(false);
  }

  async function ensurePrepared() {
    await prepareMsg91EmailOtp(MSG91_WIDGET_ID, MSG91_WIDGET_TOKEN);
    setOtpReady(true);
  }

  async function sendEmailOtp() {
    if (name.trim().length < 2) {
      setFeedback({ tone: "error", message: "Enter your full name." });
      return;
    }
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setFeedback({ tone: "error", message: "Enter a valid 10-digit Indian mobile number." });
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      setFeedback({ tone: "error", message: "Enter a valid email address." });
      return;
    }
    if (!MSG91_WIDGET_ID || !MSG91_WIDGET_TOKEN) {
      setFeedback({ tone: "error", message: "Email OTP is not configured." });
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      await ensurePrepared();
      const sent = await sendMsg91EmailOtp(email.trim().toLowerCase());
      setOtpReqId(sent.reqId || "");
      setOtpStarted(true);
      setOtpCode("");
      setToken("");
      setResendIn(45);
      setFeedback({ tone: "info", message: "Email OTP sent. Check inbox and spam for VP Loan Connect." });
    } catch (error) {
      resetMsg91EmailOtpClient();
      setOtpReady(false);
      setOtpStarted(false);
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Unable to send email OTP." });
    } finally {
      setBusy(false);
    }
  }

  async function resendEmailOtp() {
    if (resendIn > 0) return;
    setBusy(true);
    setFeedback(null);
    try {
      if (!otpReady) await ensurePrepared();
      try {
        const retried = await retryMsg91EmailOtp(otpReqId || undefined);
        if (retried.reqId) setOtpReqId(retried.reqId);
      } catch {
        const sent = await sendMsg91EmailOtp(email.trim().toLowerCase());
        setOtpReqId(sent.reqId || "");
      }
      setResendIn(45);
      setOtpCode("");
      setFeedback({ tone: "info", message: "Email OTP resent. Check inbox and spam." });
    } catch (error) {
      resetMsg91EmailOtpClient();
      setOtpReady(false);
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Unable to resend email OTP." });
    } finally {
      setBusy(false);
    }
  }

  async function verifyEmailOtp() {
    if (otpCode.length !== 6) {
      setFeedback({ tone: "error", message: "Enter the 6-digit email OTP." });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      if (!otpReady) await ensurePrepared();
      const accessToken = await verifyMsg91EmailOtp(otpCode, otpReqId || undefined);
      const response = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: name,
          mobile,
          email: email.trim().toLowerCase(),
          source: "data_deletion",
          accessToken,
        }),
      });
      const data = (await response.json()) as { error?: string; verificationToken?: string };
      if (!response.ok) throw new Error(data.error || "Unable to verify email.");
      setToken(data.verificationToken || "");
      setFeedback({ tone: "success", message: "Email verified. You can now submit the deletion request." });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Unable to verify email." });
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
        body: JSON.stringify({ verificationToken: token, mobile, email: email.trim().toLowerCase(), reason }),
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
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-700">
          <ShieldCheck size={20} />
        </span>
        <div>
          <h3 className="font-extrabold text-navy-950">Verify your registered email</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">Email OTP verification helps prevent unauthorized deletion requests.</p>
        </div>
      </div>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field label="Full name" required>
          <Input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required disabled={Boolean(token)} />
        </Field>
        <Field label="Registered mobile" required>
          <Input
            className="number-field"
            inputMode="numeric"
            autoComplete="tel"
            value={mobile}
            onChange={(event) => {
              setMobile(event.target.value.replace(/\D/g, "").slice(0, 10));
              resetOtpState();
            }}
            maxLength={10}
            required
            disabled={Boolean(token)}
            aria-label="Mobile number"
          />
        </Field>
        <Field label="Email" required hint="OTP is sent to this inbox">
          <div className="flex flex-col gap-2 min-[420px]:flex-row">
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value.trim());
                resetOtpState();
              }}
              required
              disabled={Boolean(token) || otpStarted}
              aria-label="Email address"
            />
            <Button
              type="button"
              variant="secondary"
              className="shrink-0"
              onClick={otpStarted ? resendEmailOtp : sendEmailOtp}
              disabled={busy || Boolean(token) || (otpStarted && resendIn > 0)}
            >
              {token ? <Check size={17} /> : null}
              {token ? "Verified" : !otpStarted ? "Get email code" : resendIn > 0 ? `Resend in ${resendIn}s` : "Resend email OTP"}
            </Button>
          </div>
        </Field>
        {otpStarted && !token ? (
          <Field label="6-digit email OTP" required>
            <div className="flex flex-col gap-2 min-[420px]:flex-row">
              <Input
                className="number-field"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                aria-label="Email OTP code"
              />
              <Button type="button" className="shrink-0" onClick={verifyEmailOtp} disabled={busy || otpCode.length !== 6}>
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
      {feedback ? (
        <StatusNotice tone={feedback.tone} className="mt-5">
          {feedback.message}
        </StatusNotice>
      ) : null}
      <Button type="submit" size="lg" className="mt-6 w-full" disabled={busy || !token}>
        {busy ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
        {busy ? "Submitting request…" : "Submit deletion request"}
      </Button>
    </form>
  );
}
