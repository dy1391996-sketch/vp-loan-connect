"use client";

import { useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusNotice } from "@/components/ui/status-notice";
import { LENDER_REFERRAL_CONSENT_TEXT } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Feedback = { tone: "success" | "error"; message: string } | null;

export function ReportActions({ reportId, token }: { reportId: string; token: string }) {
  const [consent, setConsent] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);

  async function request() {
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/lender-referrals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reportId, reportToken: token, consent }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save the referral request.");
      setFeedback({ tone: "success", message: "Request saved for internal review. No lender has been promised or selected." });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Unable to save the referral request." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-7 rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-brand-700 shadow-sm"><Building2 size={19} /></span>
        <div><h2 className="font-extrabold text-navy-950">Optional verified lender-referral request</h2><p className="mt-2 text-xs leading-6 text-slate-600">Partners are never displayed until verification, agreement and product approval checks are complete.</p></div>
      </div>
      <label className={cn("mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border bg-white p-4 text-xs leading-6 text-slate-600 transition", consent ? "border-brand-500/50 shadow-sm" : "border-line hover:border-slate-300")}>
        <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-brand-600" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        {LENDER_REFERRAL_CONSENT_TEXT}
      </label>
      <Button type="button" variant="secondary" className="mt-4 w-full sm:w-auto" disabled={!consent || busy} onClick={request}>
        {busy ? <Loader2 className="animate-spin" size={17} /> : null}
        {busy ? "Saving request…" : "Request internal referral review"}
      </Button>
      {feedback ? <StatusNotice tone={feedback.tone} className="mt-4">{feedback.message}</StatusNotice> : null}
    </div>
  );
}
