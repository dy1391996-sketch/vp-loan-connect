import { tokenOverlap } from "./classify";
import { newId, nowIso, type MayaStore } from "./store";

export function consolidateOwnerMemory(store: MayaStore, ownerId: string, now?: Date) {
  const at = nowIso(now);
  const active = store.listMemories({ ownerId, status: ["active", "uncertain"], limit: 1000 });
  let merged = 0;
  for (let i = 0; i < active.length; i += 1) {
    const current = active[i];
    if (current.status !== "active" && current.status !== "uncertain") continue;
    if (current.importance >= 0.8) continue;
    for (let j = i + 1; j < active.length; j += 1) {
      const other = active[j];
      if (other.type !== current.type) continue;
      if (tokenOverlap(current.normalizedFact ?? current.content, other.normalizedFact ?? other.content) < 0.82) continue;
      const keep = current.importance >= other.importance ? current : other;
      const drop = keep.memoryId === current.memoryId ? other : current;
      store.updateMemory(ownerId, drop.memoryId, { status: "archived", supersededBy: keep.memoryId, lastConfirmedAt: at });
      merged += 1;
    }
  }

  const loops = store.listOpenLoops(ownerId, ["open", "waiting"]);
  const stale = loops.filter((loop) => {
    const age = Date.parse(at) - Date.parse(loop.lastDiscussed ?? loop.createdAt);
    return age > 1000 * 60 * 60 * 24 * 120 && loop.importance < 0.7;
  });
  for (const loop of stale) {
    store.updateOpenLoop(ownerId, loop.openLoopId, { status: "dropped" });
  }

  const people = store.listPeople(ownerId);
  const summary = `Consolidation ${at}: ${active.length} active memories, ${merged} duplicates archived, ${people.length} people retained. High-value memories were kept regardless of age.`;
  store.addMemory({
    memoryId: newId(),
    ownerId,
    type: "CONVERSATION_SUMMARY",
    subtype: "consolidation",
    content: summary,
    createdAt: at,
    eventTimePrecision: "exact",
    learnedAt: at,
    lastConfirmedAt: at,
    confidence: "KNOWN",
    importance: 0.2,
    emotionalWeight: 0,
    sensitivity: "normal",
    status: "active",
    relatedPeople: [],
    relatedProjects: [],
    relatedEvents: [],
    tags: ["consolidation"],
    provenance: "INFERENCE",
  });
  return { merged, droppedLoops: stale.length, summary };
}
