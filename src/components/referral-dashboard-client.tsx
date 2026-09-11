"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { trackEvent } from "@/lib/analytics-client";

export function ReferralActions({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  const message = `Understand your credit profile before applying for a loan. A free check is available. View the ₹99 Credit Profile Booster here: ${link}. This does not guarantee loan approval.`;

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    trackEvent("referral_link_copied");
    setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    trackEvent("referral_link_shared");
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "VP Loan Connect", text: message, url: link });
        return;
      } catch {
        /* user cancelled or share failed — fall through to copy */
      }
    }
    await copy();
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
      <button
        type="button"
        onClick={share}
        className="flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 text-sm font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-card"
      >
        <Share2 size={17} />
        Share link
      </button>
    </div>
  );
}
