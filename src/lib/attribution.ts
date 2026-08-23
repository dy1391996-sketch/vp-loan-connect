/**
 * Partnership / deep-link attribution helpers.
 * Captures AppsFlyer-style and UTM params used by lender partnership landings
 * (e.g. utm_source=partnership, pid=Partner_PA_..., c=partnership).
 */

export const ATTRIBUTION_STORAGE_KEY = "vplc_attribution";

/** Keys commonly used on partner personal-loan deep links. */
export const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_id",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
  "pid",
  "c",
  "af_xp",
  "af_ad",
  "af_adset",
  "af_channel",
  "af_reengagement_window",
  "is_retargeting",
  "deep_link_value",
  "partner",
  "ref",
] as const;

export type AttributionKey = (typeof ATTRIBUTION_KEYS)[number];
export type AttributionMap = Partial<Record<AttributionKey, string>>;

const MAX_VALUE_LENGTH = 200;

function sanitizeValue(value: string): string {
  return value.trim().slice(0, MAX_VALUE_LENGTH);
}

export function pickAttribution(params: URLSearchParams | Record<string, string | null | undefined>): AttributionMap {
  const get = (key: string) => {
    if (params instanceof URLSearchParams) return params.get(key);
    return params[key] ?? null;
  };

  const result: AttributionMap = {};
  for (const key of ATTRIBUTION_KEYS) {
    const raw = get(key);
    if (!raw) continue;
    const value = sanitizeValue(raw);
    if (value) result[key] = value;
  }
  return result;
}

export function mergeAttribution(...parts: Array<AttributionMap | null | undefined>): AttributionMap {
  const merged: AttributionMap = {};
  for (const part of parts) {
    if (!part) continue;
    for (const key of ATTRIBUTION_KEYS) {
      const value = part[key];
      if (value) merged[key] = sanitizeValue(value);
    }
  }
  return merged;
}

export function readStoredAttribution(): AttributionMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return pickAttribution(parsed as Record<string, string>);
  } catch {
    return {};
  }
}

export function persistAttribution(attribution: AttributionMap): AttributionMap {
  if (typeof window === "undefined") return attribution;
  const merged = mergeAttribution(readStoredAttribution(), attribution);
  if (Object.keys(merged).length === 0) return merged;
  try {
    sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(merged));
  } catch {
    /* ignore quota / private mode */
  }
  return merged;
}

export function captureAttributionFromSearch(search: string | URLSearchParams): AttributionMap {
  const params = typeof search === "string" ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search) : search;
  const next = pickAttribution(params);
  if (Object.keys(next).length === 0) return readStoredAttribution();
  return persistAttribution(next);
}

export function getAttributionPayload(searchParams?: URLSearchParams | null): AttributionMap {
  const fromQuery = searchParams ? pickAttribution(searchParams) : {};
  return mergeAttribution(readStoredAttribution(), fromQuery);
}

/** Append stored/current attribution to an outbound official lender/partner URL. */
export function buildPartnerHandoffUrl(baseHref: string, attribution?: AttributionMap | null): string {
  let url: URL;
  try {
    url = new URL(baseHref);
  } catch {
    return baseHref;
  }

  const payload = attribution ?? readStoredAttribution();
  for (const key of ATTRIBUTION_KEYS) {
    const value = payload[key];
    if (!value) continue;
    if (!url.searchParams.has(key)) url.searchParams.set(key, value);
  }

  // Default outbound source so partner platforms can attribute VP Loan Connect traffic.
  if (!url.searchParams.has("utm_source")) {
    url.searchParams.set("utm_source", "vploanconnect");
  }
  if (!url.searchParams.has("utm_medium")) {
    url.searchParams.set("utm_medium", "referral");
  }
  if (!url.searchParams.has("utm_campaign") && payload.utm_campaign) {
    url.searchParams.set("utm_campaign", payload.utm_campaign);
  } else if (!url.searchParams.has("utm_campaign")) {
    url.searchParams.set("utm_campaign", "personal_loan_handoff");
  }

  return url.toString();
}

export function buildAssessmentEntryHref(options?: {
  loanType?: string;
  amount?: string | number;
  purpose?: string;
  attribution?: AttributionMap | null;
}): string {
  const params = new URLSearchParams();
  if (options?.loanType) params.set("loanType", String(options.loanType));
  if (options?.amount !== undefined && options.amount !== "") params.set("amount", String(options.amount));
  if (options?.purpose) params.set("purpose", options.purpose);

  const attribution = options?.attribution ?? (typeof window !== "undefined" ? readStoredAttribution() : {});
  for (const key of ATTRIBUTION_KEYS) {
    const value = attribution[key];
    if (value) params.set(key, value);
  }

  const query = params.toString();
  return query ? `/apply/quick?${query}` : "/apply/quick";
}
