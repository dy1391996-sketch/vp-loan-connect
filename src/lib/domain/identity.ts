/** PAN format utilities — format validation is NOT identity verification. */

export type PanFormatStatus =
  | "not_entered"
  | "invalid_format"
  | "format_valid";

export type PanVerificationStatus =
  | "not_verified"
  | "verification_pending"
  | "verified_authorised_provider"
  | "verification_failed"
  | "name_mismatch"
  | "provider_unavailable";

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/** 4th character encodes holder type in Indian PAN structure. */
export const PAN_HOLDER_TYPES: Record<string, string> = {
  P: "Individual / Person",
  C: "Company",
  H: "HUF",
  F: "Firm",
  A: "AOP",
  T: "Trust",
  B: "BOI",
  L: "Local authority",
  J: "Artificial juridical person",
  G: "Government",
};

export function normalizePan(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

export function isValidPanFormat(value: string): boolean {
  return PAN_REGEX.test(normalizePan(value));
}

export function panFormatStatus(value: string): PanFormatStatus {
  const normalized = normalizePan(value);
  if (!normalized) return "not_entered";
  if (!PAN_REGEX.test(normalized)) return "invalid_format";
  return "format_valid";
}

export function panHolderTypeLabel(pan: string): string | null {
  const normalized = normalizePan(pan);
  if (!PAN_REGEX.test(normalized)) return null;
  return PAN_HOLDER_TYPES[normalized[3]] ?? "Unknown holder type";
}

/** Mask for UI/logs: ABCDE****F */
export function maskPan(value: string): string {
  const pan = normalizePan(value);
  if (pan.length !== 10) return "**********";
  return `${pan.slice(0, 5)}****${pan.slice(9)}`;
}

export function isIndividualPan(pan: string): boolean {
  const normalized = normalizePan(pan);
  return PAN_REGEX.test(normalized) && normalized[3] === "P";
}
