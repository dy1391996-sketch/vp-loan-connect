"use client";

import { hasMarketingConsent } from "@/lib/consent/marketing-consent";
import { FIRST_PARTY_TO_META, createMetaEventId } from "@/lib/meta/events";
import { trackMetaPixelEvent } from "@/lib/meta/pixel-client";

export function trackEvent(eventName: string, properties?: Record<string, string | number | boolean | null>) {
  const eventId =
    (typeof properties?.event_id === "string" && properties.event_id) || createMetaEventId(eventName);
  const enriched = { ...properties, event_id: eventId };
  const payload = JSON.stringify({ eventName, page: window.location.pathname, properties: enriched });
  if (navigator.sendBeacon) navigator.sendBeacon("/api/analytics", new Blob([payload], { type: "application/json" }));
  else fetch("/api/analytics", { method: "POST", headers: { "content-type": "application/json" }, body: payload, keepalive: true }).catch(() => undefined);

  if (!hasMarketingConsent()) return;

  const metaEvents = FIRST_PARTY_TO_META[eventName];
  if (metaEvents?.length) {
    for (const metaEvent of metaEvents) {
      // One shared event_id across Pixel + CAPI for dedupe of the primary mapped event.
      const id = metaEvents.length === 1 ? eventId : createMetaEventId(`${eventName}_${metaEvent}`);
      trackMetaPixelEvent(metaEvent, { eventId: id, params: properties });
      void fetch("/api/meta/conversions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventName: metaEvent,
          eventId: id,
          eventSourceUrl: window.location.href,
          customData: properties,
        }),
        keepalive: true,
      }).catch(() => undefined);
    }
  }
}
