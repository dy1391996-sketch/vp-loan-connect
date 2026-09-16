import type { MayaConfidence, MayaMemoryType, MayaProvenance } from "./types";

const TRANSIENT_PATTERNS = [
  /चाय\s*पी/,
  /\b(chai|tea|coffee|coffee\s*pi|nashta|breakfast)\b/i,
  /^(hi+|hello|hey|yo|hola|namaste|kaise ho|kya haal)\b/i,
  /^(ok+|okay|hmm+|haan|han|theek|thanks|thank you|ty)\s*[.!?]*$/i,
  /मौसम|weather|traffic/,
];

const ROLEPLAY_PATTERNS = [
  /\b(roleplay|role-play|role play|imagine|let's pretend|lets pretend|fantasy)\b/i,
  /मान\s*लो/,
  /सोचो\s*अगर/,
  /कल्पना/,
  /\bas if we\b/i,
  /\bpretend we\b/i,
];

const CORRECTION_PATTERNS = [
  /गलत याद/,
  /इसको update करो/i,
  /ये अब पुरानी बात/,
  /\b(that'?s wrong|correct that|update that|forget that fact)\b/i,
  /\bactually\b.+\b(not|nahi|नहीं)/i,
];

const FORGET_PATTERNS = [/भूल जाओ/, /\b(delete this|erase that|forget this memory)\b/i];

const DURABLE_HINTS = [
  /business/,
  /project/,
  /payment/,
  /client/,
  /loan/,
  /company/,
  /शुरू किया/,
  /शुरू कर/,
  /promise/,
  /वादा/,
  /decision/,
  /hired/,
  /fired/,
  /married/,
  /breakup/,
  /mom|dad|brother|sister|wife|girlfriend|boyfriend|माँ|पापा|भाई|बहन/,
  /deadline/,
  /meeting/,
  /prefer/,
  /पसंद/,
];

const UNCERTAIN_HINTS = [/शायद/, /shayad/i, /\bmaybe\b/i, /\bnot sure\b/i, /sure nahi/i, /\bpossibly\b/i, /लगता है/];

const OPEN_LOOP_HINTS = [
  /karunga/,
  /karungi/,
  /करूँगा/,
  /करूंगा/,
  /pending/,
  /follow up/,
  /बाकी है/,
  /solve नहीं/,
  /solve nahi/,
  /I'll /,
  /i will /,
  /kal kar/,
];

export function isTransientSmallTalk(text: string) {
  const trimmed = text.trim();
  if (trimmed.length < 8) return true;
  return TRANSIENT_PATTERNS.some((pattern) => pattern.test(trimmed)) && !DURABLE_HINTS.some((pattern) => pattern.test(trimmed));
}

export function isRoleplayUtterance(text: string) {
  return ROLEPLAY_PATTERNS.some((pattern) => pattern.test(text));
}

export function isCorrectionUtterance(text: string) {
  return CORRECTION_PATTERNS.some((pattern) => pattern.test(text));
}

export function isForgetUtterance(text: string) {
  return FORGET_PATTERNS.some((pattern) => pattern.test(text));
}

export function estimateImportance(text: string) {
  if (isTransientSmallTalk(text)) return 0.1;
  let score = 0.35;
  if (DURABLE_HINTS.some((pattern) => pattern.test(text))) score += 0.35;
  if (OPEN_LOOP_HINTS.some((pattern) => pattern.test(text))) score += 0.15;
  if (/[!]{2,}|urgent|important|serious|मायने/.test(text)) score += 0.1;
  return Math.min(1, score);
}

export function estimateConfidence(text: string): MayaConfidence {
  if (UNCERTAIN_HINTS.some((pattern) => pattern.test(text))) return "UNCERTAIN";
  if (isTransientSmallTalk(text)) return "LIKELY";
  return "KNOWN";
}

export function classifyMemoryType(text: string): MayaMemoryType {
  if (/\b(prefer|pason|पसंद|don't like|pasand nahi)\b/i.test(text)) return "PREFERENCE";
  if (/business|project|client|deadline|company/.test(text)) return "PROJECT";
  if (OPEN_LOOP_HINTS.some((pattern) => pattern.test(text))) return "COMMITMENT";
  if (/mom|dad|brother|sister|friend|माँ|पापा|भाई|बहन|Rahul|Amit/.test(text) && /\b(my|mera|meri|मेरा|मेरी)\b/i.test(text)) return "PEOPLE";
  if (estimateImportance(text) >= 0.6) return "EPISODIC";
  return "SEMANTIC";
}

export function classifyProvenance(text: string, conversationRoleplay: boolean): MayaProvenance {
  if (conversationRoleplay || isRoleplayUtterance(text)) return "ROLEPLAY";
  return "REAL_USER_REPORTED";
}

export function shouldPersist(text: string, provenance: MayaProvenance, importance: number) {
  if (provenance === "ROLEPLAY" || provenance === "FICTION") return false;
  if (isTransientSmallTalk(text)) return false;
  return importance >= 0.45;
}

export function normalizeFact(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text: string) {
  return normalizeFact(text)
    .split(" ")
    .filter((token) => token.length > 2);
}

export function tokenOverlap(a: string, b: string) {
  const left = new Set(tokenize(a));
  const right = new Set(tokenize(b));
  if (!left.size || !right.size) return 0;
  let hit = 0;
  for (const token of left) if (right.has(token)) hit += 1;
  return hit / Math.max(left.size, right.size);
}

export function extractLikelyPersonNames(text: string) {
  const names = new Set<string>();
  const english = text.match(/\b([A-Z][a-z]{2,15})\b/g) ?? [];
  for (const name of english) {
    if (!["I", "Maya", "Instagram", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].includes(name)) {
      names.add(name);
    }
  }
  const labeled = text.match(/\b(?:my|mera|meri|मेरा|मेरी)\s+([A-Za-z\u0900-\u097F]{2,20})/gi) ?? [];
  for (const match of labeled) {
    const name = match.split(/\s+/).slice(1).join(" ");
    if (name) names.add(name);
  }
  return [...names];
}

export function extractProjectName(text: string) {
  const match = text.match(/\b(?:project|business|company)\s+([A-Za-z0-9\u0900-\u097F][A-Za-z0-9\u0900-\u097F\s]{1,40})/i);
  if (match?.[1]) return match[1].trim();
  const started = text.match(/(?:नया business|new business)\s+([A-Za-z0-9\u0900-\u097F][A-Za-z0-9\u0900-\u097F\s]{1,40})/i);
  return started?.[1]?.trim();
}

export function looksLikeOpenLoop(text: string) {
  return OPEN_LOOP_HINTS.some((pattern) => pattern.test(text));
}

export function ownerReportedMood(text: string) {
  if (/\b(sad|down|low|depressed|udaas|उदास)\b/i.test(text)) return "low";
  if (/\b(angry|frustrated|irritated|gussa|गुस्सा)\b/i.test(text)) return "frustrated";
  if (/\b(happy|excited|khush|खुश|great day)\b/i.test(text)) return "upbeat";
  if (/\b(tired|thak|थक)\b/i.test(text)) return "tired";
  return null;
}
