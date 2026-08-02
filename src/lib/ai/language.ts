import type { LanguagePref } from "@prisma/client";

const DEVANAGARI = /[\u0900-\u097F]/;
const HINGLISH =
  /\b(hai|hain|kya|kitna|chahiye|bhejo|karo|nahi|please|ji|sir|madam|aaj|kal|raat|subah)\b/i;

export function detectLanguage(text: string): LanguagePref {
  const trimmed = text.trim();
  if (!trimmed) return "UNKNOWN";
  if (DEVANAGARI.test(trimmed)) return "HI";
  if (HINGLISH.test(trimmed) && /[a-z]/i.test(trimmed)) return "HINGLISH";
  if (/^[a-z0-9\s.,!?'"₹/\-:+]+$/i.test(trimmed)) return "EN";
  if (HINGLISH.test(trimmed)) return "HINGLISH";
  return "EN";
}

export function replyLanguageInstruction(lang: LanguagePref) {
  switch (lang) {
    case "HI":
      return "Reply in natural Hindi (Devanagari). Keep it short.";
    case "HINGLISH":
      return "Reply in natural Hinglish (Roman Hindi + English mix). Keep it short and warm.";
    case "EN":
      return "Reply in clear, concise English.";
    default:
      return "Mirror the customer's language (Hindi, English or Hinglish).";
  }
}
