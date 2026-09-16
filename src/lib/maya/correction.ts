import type { MayaMemory } from "./types";
import { findRelatedMemory, supersedeMemory } from "./contradiction";
import { normalizeFact } from "./classify";
import { newId, nowIso, type MayaStore } from "./store";

export function correctMemory(store: MayaStore, ownerId: string, memoryId: string, replacement: string, now?: Date) {
  const old = store.getMemory(ownerId, memoryId);
  if (!old || old.status === "deleted") throw new Error("MEMORY_NOT_FOUND");
  const at = nowIso(now);
  const next: MayaMemory = {
    ...old,
    memoryId: newId(),
    content: replacement,
    normalizedFact: normalizeFact(replacement),
    createdAt: at,
    learnedAt: at,
    lastConfirmedAt: at,
    status: "active",
    subtype: "correction",
    tags: [...new Set([...old.tags, "correction"])],
    provenance: "REAL_USER_REPORTED",
    supersededBy: null,
  };
  const saved = supersedeMemory(store, ownerId, old, next, at);
  store.updateMemory(ownerId, old.memoryId, { status: "corrected", supersededBy: saved.memoryId });
  return { old: store.getMemory(ownerId, old.memoryId)!, next: saved };
}

export function forgetMemory(store: MayaStore, ownerId: string, memoryId: string, now?: Date) {
  return store.deleteMemory(ownerId, memoryId, nowIso(now));
}

export function applyOwnerCorrectionText(store: MayaStore, ownerId: string, text: string, now?: Date) {
  const related = findRelatedMemory(store, ownerId, { type: "SEMANTIC", content: text, normalizedFact: normalizeFact(text) });
  if (!related.existing) return null;
  return correctMemory(store, ownerId, related.existing.memoryId, text, now);
}
