"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { readMarketingConsent, writeMarketingConsent, type MarketingConsentValue } from "@/lib/consent/marketing-consent";

export function MarketingConsentBanner() {
  const [choice, setChoice] = useState<MarketingConsentValue | null | "loading">("loading");

  useEffect(() => {
    setChoice(readMarketingConsent());
  }, []);

  function decide(value: MarketingConsentValue) {
    writeMarketingConsent(value);
    setChoice(value);
    window.dispatchEvent(new CustomEvent("vplc:marketing-consent", { detail: value }));
  }

  if (choice === "loading" || choice !== null) return null;

  return (
    <div
      role="dialog"
      aria-label="Analytics consent"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-line bg-white/95 p-4 shadow-[0_-12px_40px_rgba(6,21,33,0.12)] backdrop-blur-xl sm:p-5"
    >
      <div className="page-shell flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <p className="max-w-3xl text-sm leading-6 text-slate-600">
          We use privacy-conscious analytics and, when configured, Meta measurement to understand campaign
          performance. Essential site functions work without this. See our{" "}
          <Link href="/privacy" className="font-semibold text-brand-700 underline underline-offset-2">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/consent-policy" className="font-semibold text-brand-700 underline underline-offset-2">
            Consent Policy
          </Link>
          .
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => decide("denied")}
            className="min-h-11 rounded-2xl border border-line bg-white px-4 text-sm font-bold text-navy-950"
          >
            Essential only
          </button>
          <button
            type="button"
            onClick={() => decide("granted")}
            className="min-h-11 rounded-2xl bg-navy-950 px-4 text-sm font-bold text-white"
          >
            Allow analytics
          </button>
        </div>
      </div>
    </div>
  );
}
