"use client";

import { createMetaEventId, isMetaFunnelEvent, metaPixelEventName, type MetaFunnelEvent } from "@/lib/meta/events";
import { hasMarketingConsent } from "@/lib/consent/marketing-consent";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: (...args: unknown[]) => void;
    __VPLC_META_PIXEL_ID__?: string;
  }
}

export function getPublicMetaPixelId(): string {
  if (typeof window !== "undefined" && window.__VPLC_META_PIXEL_ID__) {
    return String(window.__VPLC_META_PIXEL_ID__).trim();
  }
  return String(process.env.NEXT_PUBLIC_META_PIXEL_ID || "").trim();
}

export function setRuntimeMetaPixelId(pixelId: string) {
  if (typeof window === "undefined") return;
  const trimmed = pixelId.trim();
  if (trimmed) window.__VPLC_META_PIXEL_ID__ = trimmed;
}

export function trackMetaPixelEvent(
  event: MetaFunnelEvent | string,
  options?: { eventId?: string; params?: Record<string, string | number | boolean | null | undefined> },
): string | null {
  if (typeof window === "undefined") return null;
  if (!hasMarketingConsent()) return null;
  if (!getPublicMetaPixelId()) return null;
  if (typeof window.fbq !== "function") return null;

  const eventId = (options?.eventId || createMetaEventId(event)).slice(0, 50);
  const funnel = isMetaFunnelEvent(event) ? event : null;
  const pixelName = funnel ? metaPixelEventName(funnel) : event;
  const params: Record<string, string | number | boolean> = {};
  if (options?.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (value === null || value === undefined) continue;
      params[key] = value;
    }
  }
  if (funnel && pixelName !== funnel) params.vplc_event = funnel;

  window.fbq("track", pixelName, params, { eventID: eventId });
  return eventId;
}
