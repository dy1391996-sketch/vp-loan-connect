"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { captureAttributionFromSearch, pickAttribution } from "@/lib/attribution";
import { trackEvent } from "@/lib/analytics-client";

/** Persists partnership / UTM deep-link params for the browser session. */
export function AttributionCapture() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const captured = captureAttributionFromSearch(searchParams);
    const fromQuery = pickAttribution(searchParams);
    if (Object.keys(fromQuery).length === 0) return;

    trackEvent("attribution_captured", {
      page: pathname,
      utm_source: fromQuery.utm_source ?? null,
      utm_campaign: fromQuery.utm_campaign ?? null,
      pid: fromQuery.pid ?? null,
      partner: fromQuery.partner ?? fromQuery.c ?? null,
      keys: Object.keys(captured).join(","),
    });
  }, [pathname, searchParams]);

  return null;
}
