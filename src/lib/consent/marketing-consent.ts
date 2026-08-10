/** Browser marketing-consent helpers for analytics pixels (first-party cookie). */

export const MARKETING_CONSENT_COOKIE = "vplc_marketing_consent";
export const MARKETING_CONSENT_STORAGE_KEY = "vplc_marketing_consent";

export type MarketingConsentValue = "granted" | "denied";

export function parseMarketingConsent(raw: string | null | undefined): MarketingConsentValue | null {
  if (raw === "granted" || raw === "denied") return raw;
  return null;
}

export function readMarketingConsent(): MarketingConsentValue | null {
  if (typeof document === "undefined") return null;
  try {
    const fromStorage = parseMarketingConsent(window.localStorage.getItem(MARKETING_CONSENT_STORAGE_KEY));
    if (fromStorage) return fromStorage;
  } catch {
    /* private mode */
  }
  const match = document.cookie.match(/(?:^|;\s*)vplc_marketing_consent=([^;]+)/);
  return parseMarketingConsent(match?.[1] ? decodeURIComponent(match[1]) : null);
}

export function writeMarketingConsent(value: MarketingConsentValue) {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 180;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${MARKETING_CONSENT_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
  try {
    window.localStorage.setItem(MARKETING_CONSENT_STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}

export function hasMarketingConsent(): boolean {
  return readMarketingConsent() === "granted";
}
