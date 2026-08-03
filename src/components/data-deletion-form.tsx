"use client";

import { useState } from "react";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { StatusNotice } from "@/components/ui/status-notice";

type Feedback = { tone: "success" | "error" | "info"; message: string } | null;

const MSG91_WIDGET_ID = process.env.NEXT_PUBLIC_MSG91_WIDGET_ID ?? "";
const MSG91_WIDGET_TOKEN = process.env.NEXT_PUBLIC_MSG91_WIDGET_TOKEN ?? "";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getMsg91AccessToken(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const key of ["accessToken", "access-token", "token"]) {
    if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
  }
  for (const child of Object.values(record)) {
    const token = getMsg91AccessToken(child);
    if (token) return token;
  }
  return "";
}

export function DataDeletionForm() {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [otpStarted, setOtpStarted] = useState(false);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);

  async function requestEmailOtp() {
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
    setOtpStarted(true);

    const completeVerification = async (widgetResponse: unknown) => {
      try {
        const accessToken = getMsg91AccessToken(widgetResponse);
        if (!accessToken) throw new Error("Email verification token was not received. Please try again.");
        const response = await fetch("/api/otp/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            fullName: name,
            mobile,
            email,
            source: "data_deletion",
            accessToken,
          }),
        });
        const data = (await response.json()) as { error?: string; verificationToken?: string };
        if (!response.ok) throw new Error(data.error || "Unable to verify email.");
        setToken(data.verificationToken || "");
        setFeedback({ tone: "success", message: "Email verified. You can now submit the deletion request." });
      } catch (error) {
        setOtpStarted(false);
        setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Unable to verify email." });
      } finally {
        setBusy(false);
      }
    };

    const failVerification = (reason: unknown) => {
      console.error("msg91_widget_failed", reason);
      setOtpStarted(false);
      setBusy(false);
      setFeedback({ tone: "error", message: "Email OTP verification was not completed. Please try again." });
    };

    const configuration = {
      widgetId: MSG91_WIDGET_ID,
      tokenAuth: MSG91_WIDGET_TOKEN,
      identifier: email,
      success: (data: unknown) => {
        void completeVerification(data);
      },
      failure: failVerification,
    };

    try {
      const widgetWindow = window as Window & { initSendOTP?: (config: typeof configuration) => void };
      const launch = () => {
        if (typeof widgetWindow.initSendOTP !== "function") throw new Error("Email OTP service did not start.");
        widgetWindow.initSendOTP(configuration);
      };
      if (typeof widgetWindow.initSendOTP === "function") {
        launch();
        return;
      }
      const urls = ["https://verify.msg91.com/otp-provider.js", "https://verify.phone91.com/otp-provider.js"];
      let index = 0;
      const loadNext = () => {
        const script = document.createElement("script");
        script.src = urls[index];
        script.async = true;
        script.onload = () => {
          try {
            launch();
          } catch (err) {
            failVerification(err);
          }
        };
        script.onerror = () => {
          index += 1;
          if (index < urls.length) loadNext();
          else failVerification(new Error("Email OTP service unavailable"));
        };
        document.head.appendChild(script);
      };
      loadNext();
    } catch (err) {
      failVerification(err);
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
        body: JSON.stringify({ verificationToken: token, mobile, email, reason }),
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
              setToken("");
              setOtpStarted(false);
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
                setToken("");
                setOtpStarted(false);
              }}
              required
              disabled={Boolean(token)}
              aria-label="Email address"
            />
            <Button type="button" variant="secondary" className="shrink-0" onClick={requestEmailOtp} disabled={busy || Boolean(token)}>
              {token ? <Check size={17} /> : null}
              {token ? "Verified" : otpStarted ? "Resend email OTP" : "Get email code"}
            </Button>
          </div>
        </Field>
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
