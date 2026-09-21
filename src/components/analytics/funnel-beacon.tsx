"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics-client";

const STORAGE_PREFIX = "vplc_evt_";

export function funnelEventStorageKey(dedupeKey: string) {
  return `${STORAGE_PREFIX}${dedupeKey.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80)}`;
}

export function markFunnelEventSent(dedupeKey: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(funnelEventStorageKey(dedupeKey), "1");
  } catch {
    /* Private mode can block storage; the in-memory ref still prevents a double fire. */
  }
}

export function hasFunnelEventSent(dedupeKey: string) {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(funnelEventStorageKey(dedupeKey)) === "1";
  } catch {
    return false;
  }
}

/**
 * Fire one funnel event per browser session key.
 * Cashfree returns through a server redirect, so success and failure pages
 * must emit the event the checkout button never gets to send.
 */
export function FunnelBeacon({
  eventName,
  dedupeKey,
  properties,
  firstParty = true,
}: {
  eventName: string;
  dedupeKey: string;
  properties?: Record<string, string | number | boolean | null>;
  firstParty?: boolean;
}) {
  const sent = useRef(false);
  const propertiesRef = useRef(properties);
  propertiesRef.current = properties;

  useEffect(() => {
    if (sent.current || hasFunnelEventSent(dedupeKey)) return;
    sent.current = true;
    markFunnelEventSent(dedupeKey);
    trackEvent(eventName, propertiesRef.current, { firstParty });
  }, [dedupeKey, eventName, firstParty]);

  return null;
}
