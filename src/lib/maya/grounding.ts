/**
 * Stop the model from stating a clock time, calendar date, or money amount
 * that the owner never said and that is not in verified memories.
 * Prior Maya replies are not evidence.
 *
 * Prefer stripping inventions over replacing the whole reply with a canned line.
 */

const CLOCK = /\b\d{1,2}[:.]\d{2}(?:\s*(?:am|pm|baje))?\b/gi;
const CLOCK_WORD = /\b\d{1,2}\s*(?:am|pm|baje)\b/gi;
const MONTH_DATE =
  /\b(?:\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2})\b/gi;
const NUMERIC_DATE = /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g;
const MONEY =
  /(?:₹|rs\.?|inr)\s*[\d,]+(?:\.\d+)?|\b[\d,]+(?:\.\d+)?\s*(?:₹|rs|rupees|rupaye|रुपये)\b/gi;

function mentioned(corpus: string, token: string) {
  return corpus.toLowerCase().includes(token.toLowerCase());
}

function isPlausibleClock(token: string) {
  const match = token.match(/(\d{1,2})[:.](\d{2})/);
  if (!match) return true;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59;
}

export function findUnsupportedSpecifics(reply: string, corpus: string): string[] {
  const found: string[] = [];
  const consider = (pattern: RegExp) => {
    pattern.lastIndex = 0;
    for (const match of reply.matchAll(pattern)) {
      const token = match[0].trim();
      if (!token || !isPlausibleClock(token) || mentioned(corpus, token)) continue;
      const digits = token.match(/\d{1,2}[:.]\d{2}/)?.[0];
      if (digits && (mentioned(corpus, digits) || mentioned(corpus, digits.replace(":", ".")))) continue;
      const bare = token.replace(/[^\d.]/g, "");
      if (bare && mentioned(corpus, bare) && !/[:.]/.test(token)) continue;
      found.push(token);
    }
  };

  consider(CLOCK);
  consider(CLOCK_WORD);
  consider(MONTH_DATE);
  consider(NUMERIC_DATE);
  consider(MONEY);
  return found;
}

function asksForMissingFact(utterance: string) {
  return /\b(baje|kitne|kitna|kab|time|tareekh|tareek|date|amount|price|fees?|kitne\s*ka)\b/i.test(utterance);
}

function alreadySaysUnknown(reply: string) {
  return /\b(nahi pata|nahin pata|don't know|do not know|not sure|pata nahi|unknown|bataya nahi|nahi bataya|not given|not told)\b/i.test(
    reply,
  );
}

function unknownAsk(utterance: string) {
  if (/[\u0900-\u097F]/.test(utterance) || /\b(kya|kab|kitne|kitna|baje|hai|nahi|kal)\b/i.test(utterance)) {
    return "Mujhe nahi pata — tumne abhi bataya nahi. Bataoge?";
  }
  return "I don't know that — you haven't told me yet. What should I use?";
}

function stripUnsupportedSentences(reply: string, unsupported: string[]) {
  const sentences = reply.split(/(?<=[.!?।])\s+/);
  const kept = sentences.filter((sentence) => !unsupported.some((token) => sentence.toLowerCase().includes(token.toLowerCase())));
  return kept.join(" ").replace(/\s+/g, " ").trim();
}

export function groundAssistantReply(reply: string, corpus: string, utterance: string): string {
  const unsupported = findUnsupportedSpecifics(reply, corpus);
  let next = reply.trim();
  if (unsupported.length) {
    const stripped = stripUnsupportedSentences(reply, unsupported);
    if (stripped.length >= 12) {
      next = stripped;
    } else if (asksForMissingFact(utterance) || alreadySaysUnknown(reply)) {
      next = alreadySaysUnknown(reply) && stripped.length >= 8 ? stripped : unknownAsk(utterance);
    } else {
      next = stripped.length >= 8 ? stripped : unknownAsk(utterance);
    }
  }
  next = hedgeUnsupportedSharedPast(next, corpus, utterance);
  return briefenReply(next, utterance);
}

/**
 * If the owner asks whether a shared past event happened and nothing in the
 * verified corpus supports it, do not let an affirming invention stand.
 */
function hedgeUnsupportedSharedPast(reply: string, corpus: string, utterance: string): string {
  const asking =
    /\b(hum|we|humne|humara|hamara)\b/i.test(utterance) &&
    /\b(gaye|gayi|gay|went|kiye|kiya|the kya|tha kya|thi kya)\b/i.test(utterance);
  if (!asking) return reply;
  const affirms = /^(haan|han|yes|yeah|yep|bilkul|of course|absolutely)\b/i.test(reply.trim());
  if (!affirms) return reply;
  const anchors = utterance
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4)
    .filter((token) => !/^(kal|raat|gaye|gayi|humne|humara|hamara|theek|kitne|kitna)$/i.test(token));
  const hay = corpus.toLowerCase();
  if (anchors.some((token) => hay.includes(token))) return reply;
  if (/[\u0900-\u097F]/.test(utterance) || /\b(kya|hai|nahi|kal|hum)\b/i.test(utterance)) {
    return "Mere verified yaad mein yeh shared baat nahi hai. Agar tumne bataya ho toh dobara bola do.";
  }
  return "I don't have that as a verified shared memory. If it happened, tell me again and I'll keep it.";
}

/** Only trim obvious greeting monologues — do not chop normal conversation. */
export function briefenReply(reply: string, utterance: string): string {
  const text = utterance.trim();
  const greeting =
    text.length <= 40 &&
    /^(hi+|hello|hey(\s+baby)?|yo|hola|namaste|kaise\s*ho|kya\s*haal|i love u+|love you)\s*[.!?❤️🫀]*$/i.test(text);
  if (!greeting) return reply.trim();
  const sentences = reply
    .split(/(?<=[.!?।])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (sentences.length <= 2) return reply.trim();
  return sentences.slice(0, 2).join(" ").replace(/\s+/g, " ").trim();
}

/** Hide unsupported specifics inside earlier Maya lines so they are not reused as facts. */
export function redactAssistantSpecifics(text: string, corpus: string): string {
  const unsupported = findUnsupportedSpecifics(text, corpus);
  if (!unsupported.length) return text;
  let next = text;
  for (const token of unsupported) {
    next = next.split(token).join("");
  }
  const cleaned = next.replace(/\s+/g, " ").trim();
  return cleaned.length >= 8 ? cleaned : text;
}
