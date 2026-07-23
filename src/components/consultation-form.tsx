"use client";

import { useState } from "react";
import { CalendarCheck, Loader2, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { StatusNotice } from "@/components/ui/status-notice";
import { trackEvent } from "@/lib/analytics-client";

type Feedback = { tone: "success" | "error"; message: string } | null;

export function ConsultationForm({ assessmentId, token }: { assessmentId: string; token: string }) {
  const [slot, setSlot] = useState("");
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/consultations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assessmentId,
          resultToken: token,
          preferredSlot: slot ? new Date(slot).toISOString() : "",
          notes,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save your consultation request.");
      setFeedback({ tone: "success", message: "Request received. The Support Team will confirm availability through your verified contact." });
      trackEvent("consultation_requested");
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Unable to save your consultation request." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-[2rem] border border-line/80 bg-white p-6 shadow-soft sm:p-8">
      <div className="flex items-start gap-4 border-b border-line pb-6">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-700"><CalendarCheck size={20} /></span>
        <div><h2 className="font-extrabold text-navy-950">Choose a preferred time</h2><p className="mt-1 text-xs leading-5 text-slate-500">The final slot is confirmed separately by the Support Team.</p></div>
      </div>
      <div className="mt-6 grid gap-5">
        <Field label="Preferred date and time" hint="Select a convenient date and time.">
          <Input type="datetime-local" value={slot} onChange={(event) => setSlot(event.target.value)} />
        </Field>
        <Field label="What would you like to discuss?" hint={`${notes.length}/1000 characters`}>
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} placeholder="Share the profile or report questions you want to cover." />
        </Field>
      </div>
      {feedback ? <StatusNotice tone={feedback.tone} className="mt-5">{feedback.message}</StatusNotice> : null}
      <Button type="submit" size="lg" className="mt-6 w-full" disabled={busy}>
        {busy ? <Loader2 className="animate-spin" size={18} /> : <MessageSquareText size={18} />}
        {busy ? "Submitting request…" : "Request consultation"}
      </Button>
    </form>
  );
}
