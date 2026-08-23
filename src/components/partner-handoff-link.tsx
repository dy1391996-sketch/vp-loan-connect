"use client";

import type { ReactNode } from "react";
import { buildPartnerHandoffUrl, getAttributionPayload } from "@/lib/attribution";
import { trackEvent } from "@/lib/analytics-client";

type Props = {
  href: string;
  name: string;
  className?: string;
  children: ReactNode;
};

/** Outbound official-platform link with session attribution appended. */
export function PartnerHandoffLink({ href, name, className, children }: Props) {
  function onClick() {
    trackEvent("partner_link_clicked", {
      partner_name: name,
      destination_host: (() => {
        try {
          return new URL(href).hostname;
        } catch {
          return "unknown";
        }
      })(),
    });
    trackEvent("partner_handoff_click", {
      partner_name: name,
      destination_host: (() => {
        try {
          return new URL(href).hostname;
        } catch {
          return "unknown";
        }
      })(),
    });
  }

  return (
    <a
      href={buildPartnerHandoffUrl(href, getAttributionPayload())}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={onClick}
    >
      {children}
    </a>
  );
}
