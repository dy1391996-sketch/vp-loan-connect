/**
 * Approved public contact routes for VP Loan Connect:
 * - Website Quick Apply
 * - Instagram Direct (when NEXT_PUBLIC_INSTAGRAM_URL is configured)
 * - Verified official business email
 *
 * Never expose owner/staff/customer phone numbers or WhatsApp click-to-chat CTAs.
 */

export const QUICK_APPLY_HREF = "/apply/quick";

/** Approved public Instagram profile. Website domain vploanconnect.in is not this handle. */
export const APPROVED_INSTAGRAM_PROFILE_URL = "https://www.instagram.com/vploanconnect/";

function canonicalInstagramHandle(handle: string): string {
  const normalized = handle.replace(/\/+$/, "");
  if (normalized.toLowerCase() === "vploanconnect.in") return "vploanconnect";
  return normalized;
}

/** Public Instagram profile or Direct link from env. Empty when unset. Legacy @vploanconnect.in is rewritten. */
export function getPublicInstagramUrl(environment: Record<string, string | undefined> = process.env): string {
  const raw = String(environment.NEXT_PUBLIC_INSTAGRAM_URL || "").trim();
  if (!raw) return "";

  // Accept bare handle / @handle from operators and normalize to https Instagram URL.
  const handleMatch = raw.match(/^@?([A-Za-z0-9._]{1,30})$/);
  const normalized = handleMatch
    ? `https://www.instagram.com/${canonicalInstagramHandle(handleMatch[1])}/`
    : raw;

  try {
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase();
    const allowed =
      host === "instagram.com" ||
      host === "www.instagram.com" ||
      host === "ig.me" ||
      host === "www.ig.me";
    if (!allowed) return "";
    if (url.protocol !== "https:") return "";
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.some((segment) => segment.toLowerCase() === "vploanconnect.in")) {
      return APPROVED_INSTAGRAM_PROFILE_URL;
    }
    return url.toString();
  } catch {
    return "";
  }
}

export function isPublicWhatsAppHref(href: string): boolean {
  try {
    const url = new URL(href, "https://www.vploanconnect.in");
    const host = url.hostname.toLowerCase();
    return host === "wa.me" || host === "api.whatsapp.com" || host === "web.whatsapp.com" || host.endsWith(".whatsapp.com");
  } catch {
    return /wa\.me|whatsapp\.com/i.test(href);
  }
}

export function isPublicTelHref(href: string): boolean {
  return /^tel:/i.test(href.trim());
}
