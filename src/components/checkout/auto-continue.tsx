"use client";

import { useEffect } from "react";

/** After a verified booster payment, continue into the detailed profile without another charge. */
export function AutoContinue({ href, delayMs = 1400 }: { href: string; delayMs?: number }) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.location.assign(href);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [href, delayMs]);

  return <p className="mt-4 text-sm font-semibold text-slate-600">Taking you to your detailed profile…</p>;
}
