import type { MayaMemory, MayaMemoryStatus } from "./types";
import { tokenOverlap } from "./classify";
import type { MayaStore } from "./store";

export interface ContradictionResult {
  kind: "none" | "duplicate" | "contradiction";
  existing?: MayaMemory;
  score: number;
}

const CONTRADICTION_PAIRS: Array<[RegExp, RegExp]> = [
  [/\b(pending|open|not done|बाकी|नहीं हुआ|nahi hua)\b/i, /\b(done|completed|finished|ho gaya|हो गया|solve ho)\b/i],
  [/\b(single|unmarried)\b/i, /\b(married|engaged)\b/i],
  [/\b(hate|pasand nahi|don't like)\b/i, /\b(love|pasand|like)\b/i],
  [/\bmorning\b/i, /\bevening\b/i],
];

export function findRelatedMemory(store: MayaStore, ownerId: string, candidate: Pick<MayaMemory, "normalizedFact" | "content" | "type">): ContradictionResult {
  const active = store.listMemories({ ownerId, status: ["active", "uncertain"], limit: 400 });
  let best: ContradictionResult = { kind: "none", score: 0 };
  for (const existing of active) {
    const score = tokenOverlap(existing.normalizedFact ?? existing.content, candidate.normalizedFact ?? candidate.content);
    if (score < 0.28) continue;
    const contradiction = isContradiction(existing.content, candidate.content);
    const kind = contradiction ? "contradiction" : score >= 0.72 && existing.type === candidate.type ? "duplicate" : score >= 0.55 ? "duplicate" : "none";
    if (kind !== "none" && score >= best.score) best = { kind, existing, score };
  }
  return best;
}

export function isContradiction(oldText: string, newText: string) {
  for (const [left, right] of CONTRADICTION_PAIRS) {
    if ((left.test(oldText) && right.test(newText)) || (right.test(oldText) && left.test(newText))) return true;
  }
  return false;
}

export function supersedeMemory(store: MayaStore, ownerId: string, oldMemory: MayaMemory, newMemory: MayaMemory, at: string) {
  store.updateMemory(ownerId, oldMemory.memoryId, {
    status: "superseded" as MayaMemoryStatus,
    supersededBy: newMemory.memoryId,
    lastConfirmedAt: at,
  });
  return store.addMemory({
    ...newMemory,
    subtype: newMemory.subtype ?? "correction",
    tags: [...new Set([...newMemory.tags, "correction"])],
  });
}
