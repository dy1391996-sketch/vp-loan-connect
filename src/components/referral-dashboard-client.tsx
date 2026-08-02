"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { trackEvent } from "@/lib/analytics-client";

export function ReferralActions({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  const message = `Loan apply se pehle apni credit profile samjhein. Free check available. ₹99 Credit Profile Booster yahan: ${link}. Yeh loan approval guarantee nahi hai.`;

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    trackEvent("referral_link_copied");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
      <button
        type="button"
        onClick={copy}
        className="flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-extrabold text-navy-950 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card"
        aria-live="polite"
      >
        {copied ? <Check className="text-brand-700" size={17} /> : <Copy size={17} />}
        {copied ? "Link copied" : "Copy link"}
      </button>
      <a
        onClick={() => trackEvent("whatsapp_share_clicked")}
        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noreferrer"
        className="flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 text-sm font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-card"
      >
        <MessageCircle size={17} />
        Share on WhatsApp
      </a>
    </div>
  );
}
