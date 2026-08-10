"use client";

import { Instagram } from "lucide-react";
import { trackEvent } from "@/lib/analytics-client";

type Props = {
  href: string;
  className?: string;
  children?: React.ReactNode;
};

export function InstagramDirectLink({ href, className, children }: Props) {
  function onClick() {
    // Single path: trackEvent emits first-party + consent-gated Pixel/CAPI with one shared event_id.
    trackEvent("instagram_profile_click");
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
