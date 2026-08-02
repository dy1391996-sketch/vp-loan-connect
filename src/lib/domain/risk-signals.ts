const REPEATED_CHAR = /(.)\1{4,}/i;
const DUMMY_WORDS = /^(test|testing|asdf|qwerty|demo|sample|abc|abcd|abcdef|xxx|zzzz|na|n\/a|none|user|name|address|dummy|fake)$/i;
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "temp-mail.org",
  "10minutemail.com",
  "yopmail.com",
  "trashmail.com",
  "sharklasers.com",
]);

export function looksLikeDummyText(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (DUMMY_WORDS.test(trimmed)) return true;
  if (REPEATED_CHAR.test(trimmed.replace(/\s+/g, ""))) return true;
  const letters = trimmed.replace(/[^A-Za-z]/g, "");
  if (letters.length >= 4 && new Set(letters.toLowerCase()).size === 1) return true;
  return false;
}

export function looksLikeFakePersonName(value: string): boolean {
  const trimmed = value.trim();
  if (looksLikeDummyText(trimmed)) return true;
  if (!/[A-Za-z]{2,}/.test(trimmed)) return true;
  if (/^\d+$/.test(trimmed)) return true;
  if (trimmed.length < 2) return true;
  return false;
}

export function looksLikeWeakAddress(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 12) return true;
  if (looksLikeDummyText(trimmed)) return true;
  if (/^\d+$/.test(trimmed)) return true;
  if (!/[A-Za-z]{3,}/.test(trimmed)) return true;
  // Require at least some locality-like content (letter + digit or multi-word).
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 2 && !/\d/.test(trimmed)) return true;
  return false;
}

export function isDisposableEmailDomain(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}

export function isImpossibleMobile(mobile: string): boolean {
  const digits = mobile.replace(/\D/g, "");
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  if (!/^[6-9]\d{9}$/.test(local)) return true;
  if (/^(\d)\1{9}$/.test(local)) return true;
  if (local === "9876543210" || local === "1234567890") return true;
  return false;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
