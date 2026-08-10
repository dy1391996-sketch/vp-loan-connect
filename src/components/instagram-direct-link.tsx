"use client";

import { Instagram } from "lucide-react";
import { trackEvent } from "@/lib/analytics-client";
import { createMetaEventId } from "@/lib/meta/events";
import { trackMetaPixelEvent } from "@/lib/meta/pixel-client";

type Props = {
  href: string;
  className?: string;
  children?: React.ReactNode;
};

export function InstagramDirectLink({ href, className, children }: Props) {
  function onClick() {
    const eventId = createMetaEventId("ig_click");
    trackEvent("instagram_profile_click", { event_id: eventId });
    trackMetaPixelEvent("InstagramProfileClick", { eventId });
    void fetch("/api/meta/conversions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventName: "InstagramProfileClick",
        eventId,
        eventSourceUrl: window.location.href,
      }),
      keepalive: true,
    }).catch(() => undefined);
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className}>
      {children ?? (
        <>
          <Instagram size={15} aria-hidden />
          Instagram Direct
        </>
      )}
    </a>
  );
}
