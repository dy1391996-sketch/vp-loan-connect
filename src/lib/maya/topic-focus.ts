import { tokenize } from "./classify";

const OVERLAP_STOP = new Set([
  "hai",
  "hain",
  "tha",
  "thi",
  "the",
  "and",
  "for",
  "you",
  "tum",
  "tera",
  "teri",
  "mera",
  "meri",
  "with",
  "that",
  "this",
  "nahi",
  "nahin",
  "kya",
  "aur",
  "par",
  "se",
  "ko",
  "ki",
  "ke",
  "ka",
  "ek",
  "bas",
  "toh",
  "bhi",
  "but",
  "not",
  "are",
  "was",
  "were",
  "have",
  "has",
  "had",
  "will",
  "can",
  "may",
  "from",
  "your",
  "our",
  "about",
  "just",
  "like",
  "then",
  "than",
  "when",
  "what",
  "how",
  "who",
  "why",
  "main",
  "mein",
  "hum",
  "woh",
  "yeh",
  "ab",
  "phir",
  "agar",
  "only",
  "very",
  "kar",
  "ho",
  "hoga",
  "hogi",
  "liye",
  "wala",
  "wali",
  "wale",
  "maya",
  "owner",
  "kal",
  "aaj",
  "ab",
  "subah",
  "shaam",
  "raat",
  "dopahar",
  "today",
  "tomorrow",
  "yesterday",
  "night",
  "morning",
  "evening",
  // Bare time-ask fillers must not glue unrelated clock memories together.
  "baje",
  "baja",
  "kitne",
  "kitna",
  "time",
  "kab",
  "batao",
  "bata",
  "yaad",
  "rakhna",
  "rakh",
]);

export function contentTokens(text: string) {
  return tokenize(text).filter((token) => !OVERLAP_STOP.has(token));
}

export function meaningfulOverlap(a: string, b: string) {
  const left = new Set(contentTokens(a));
  const right = new Set(contentTokens(b));
  if (!left.size || !right.size) return 0;
  let hit = 0;
  for (const token of left) if (right.has(token)) hit += 1;
  return hit / Math.max(left.size, right.size);
}

/** Owner is asking to bring back a prior fact (time, favourite, that call, etc.). */
export function looksLikeExplicitRecall(utterance: string) {
  const text = utterance.trim();
  // Bare time asks refer to the active topic, not an older remembered event.
  if (/^(kitne\s*baje|kitna\s*baja|kab|kaunsi\s*tareekh|what\s*time)\s*[?؟!.]*$/i.test(text)) {
    return false;
  }
  return (
    /\b(yaad|remember|remind|favourite|favorite|pasand)\b/i.test(text) ||
    /\b(woh|wo|that|earlier|pehle|pahle)\b/i.test(text) ||
    /\b(mera|meri|my)\s+\w+\s+(kya|what)\b/i.test(text)
  );
}

type FocusMessage = { role: string; text: string; messageId?: string };

/**
 * Latest owner message is the active topic.
 * Older turns stay only when they overlap that topic or the owner is explicitly recalling.
 * Critically: do NOT keep a prior Maya monologue just because it was the previous turn.
 */
export function focusRecentMessages<T extends FocusMessage>(messages: T[], utterance: string): T[] {
  if (messages.length <= 1) return messages;

  const recall = looksLikeExplicitRecall(utterance);
  let lastOwnerIdx = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "owner") {
      lastOwnerIdx = index;
      break;
    }
  }
  if (lastOwnerIdx < 0) return messages.slice(-4);

  const keep = new Set<T>([messages[lastOwnerIdx]]);
  for (let index = lastOwnerIdx + 1; index < messages.length; index += 1) {
    keep.add(messages[index]);
  }

  for (let index = 0; index < lastOwnerIdx; index += 1) {
    const message = messages[index];
    const overlap = meaningfulOverlap(message.text, utterance);
    if (overlap >= 0.14) {
      keep.add(message);
      continue;
    }
    if (recall && message.role === "owner") {
      const timeFact = /\b\d{1,2}[:.]\d{2}\b/.test(message.text);
      const topical =
        /\b(call|meeting|appointment|chai|favourite|favorite|pasand)\b/i.test(message.text) &&
        /\b(call|meeting|appointment|chai|favourite|favorite|pasand|baje|kitne)\b/i.test(utterance);
      if (timeFact || topical || overlap > 0) {
        keep.add(message);
        if (index + 1 < lastOwnerIdx && messages[index + 1].role === "maya") {
          // Keep a short adjacent Maya ack only when recalling a fact, not long digressions.
          if (messages[index + 1].text.length <= 160) keep.add(messages[index + 1]);
        }
      }
    }
  }

  const ordered = messages.filter((message) => keep.has(message));
  if (!recall && ordered.length === 1) return ordered;
  return ordered.slice(-8);
}
