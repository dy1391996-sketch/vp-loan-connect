import type { MayaSeedDocument } from "./types";
import { emptySnapshot, newId, nowIso, type MayaStore, type MayaStoreSnapshot } from "./store";
import { normalizeFact } from "./classify";
import { defaultRelationshipState } from "./state";

const INVENTED_HISTORY = /\b(honeymoon|date night|we met in person|phone call|called me|hugged|kissed|touched|gifted|promised|physically|went to goa|went to paris|shared trip)\b/i;

function historyStatus(seed: MayaSeedDocument) {
  return seed.ownerHistoryStatus ?? "not-provided";
}

export function assertSeedImportSafe(seed: MayaSeedDocument) {
  if (seed.source !== "SYSTEM_SEED") throw new Error("SEED_SOURCE_INVALID");
  for (const fact of seed.relationshipContextFacts ?? []) {
    if (INVENTED_HISTORY.test(fact.content)) throw new Error("SEED_REJECTS_UNVERIFIED_PERSONAL_HISTORY");
  }
  const historical = [
    ...(seed.people ?? []).map((item) => ({ kind: "person", verified: item.verified, content: `${item.name} ${item.relevantContext ?? ""}` })),
    ...(seed.projects ?? []).map((item) => ({ kind: "project", verified: item.verified, content: `${item.name} ${item.description ?? ""}` })),
    ...(seed.events ?? []).map((item) => ({ kind: "event", verified: item.verified, content: item.content })),
    ...(seed.ongoingMatters ?? []).map((item) => ({ kind: "ongoing", verified: item.verified, content: item.content })),
    ...(seed.preferences ?? []).map((item) => ({ kind: "preference", verified: item.verified, content: item.content })),
  ];
  if (historical.length && historyStatus(seed) === "not-provided") {
    throw new Error("SEED_HISTORY_NOT_PROVIDED");
  }
  for (const item of historical) {
    if (item.verified !== true) {
      throw new Error(`SEED_${item.kind.toUpperCase()}_REQUIRES_VERIFIED`);
    }
    if (INVENTED_HISTORY.test(item.content) && historyStatus(seed) !== "verified") {
      throw new Error("SEED_REJECTS_UNVERIFIED_PERSONAL_HISTORY");
    }
  }
}

export function backupStore(store: MayaStore, options?: { includeOwnerSecrets?: boolean }) {
  const snapshot = store.snapshot();
  const owners = options?.includeOwnerSecrets
    ? snapshot.owners
    : snapshot.owners.map((row) => ({ ...row, passwordHash: "[redacted]" }));
  return {
    format: "maya-backup-v1",
    createdAt: nowIso(),
    snapshot: { ...snapshot, owners, sessions: [] },
  };
}

export function exportOwnerArchive(store: MayaStore, ownerId: string) {
  const snap = store.snapshot();
  const scoped: MayaStoreSnapshot = {
    owners: snap.owners.filter((row) => row.ownerId === ownerId).map((row) => ({ ...row, passwordHash: "[redacted]" })),
    sessions: [],
    conversations: snap.conversations.filter((row) => row.ownerId === ownerId),
    messages: snap.messages.filter((row) => row.ownerId === ownerId),
    memories: snap.memories.filter((row) => row.ownerId === ownerId && row.status !== "deleted"),
    people: snap.people.filter((row) => row.ownerId === ownerId),
    projects: snap.projects.filter((row) => row.ownerId === ownerId),
    openLoops: snap.openLoops.filter((row) => row.ownerId === ownerId),
    timeline: snap.timeline.filter((row) => row.ownerId === ownerId),
    relationshipState: snap.relationshipState.filter((row) => row.ownerId === ownerId),
    visualAssets: snap.visualAssets.filter((row) => row.ownerId === ownerId),
  };
  return {
    format: "maya-archive-v1",
    exportedAt: nowIso(),
    ownerId,
    json: scoped,
    markdown: renderMarkdown(scoped),
  };
}

export function restoreOwnerArchive(store: MayaStore, archive: { ownerId: string; json: MayaStoreSnapshot }, mode: "replace" | "merge" = "replace") {
  const current = store.snapshot();
  if (mode === "replace") {
    const kept: MayaStoreSnapshot = {
      owners: current.owners,
      sessions: current.sessions.filter((row) => row.ownerId !== archive.ownerId),
      conversations: current.conversations.filter((row) => row.ownerId !== archive.ownerId).concat(archive.json.conversations),
      messages: current.messages.filter((row) => row.ownerId !== archive.ownerId).concat(archive.json.messages),
      memories: current.memories.filter((row) => row.ownerId !== archive.ownerId).concat(archive.json.memories),
      people: current.people.filter((row) => row.ownerId !== archive.ownerId).concat(archive.json.people),
      projects: current.projects.filter((row) => row.ownerId !== archive.ownerId).concat(archive.json.projects),
      openLoops: current.openLoops.filter((row) => row.ownerId !== archive.ownerId).concat(archive.json.openLoops),
      timeline: current.timeline.filter((row) => row.ownerId !== archive.ownerId).concat(archive.json.timeline),
      relationshipState: current.relationshipState.filter((row) => row.ownerId !== archive.ownerId).concat(archive.json.relationshipState),
      visualAssets: current.visualAssets.filter((row) => row.ownerId !== archive.ownerId).concat(archive.json.visualAssets),
    };
    store.loadSnapshot(kept);
  } else {
    const merged = structuredClone(current);
    merged.conversations.push(...archive.json.conversations);
    merged.messages.push(...archive.json.messages);
    merged.memories.push(...archive.json.memories);
    merged.people.push(...archive.json.people);
    merged.projects.push(...archive.json.projects);
    merged.openLoops.push(...archive.json.openLoops);
    merged.timeline.push(...archive.json.timeline);
    store.loadSnapshot(merged);
  }
}

export function restoreBackup(store: MayaStore, backup: { snapshot: MayaStoreSnapshot }) {
  store.loadSnapshot(backup.snapshot ?? emptySnapshot());
}

export function importSeed(store: MayaStore, ownerId: string, seed: MayaSeedDocument) {
  assertSeedImportSafe(seed);
  const at = nowIso();
  if (!store.getRelationshipState(ownerId)) store.saveRelationshipState(defaultRelationshipState(ownerId, at));
  const created: string[] = [];

  for (const fact of seed.relationshipContextFacts ?? []) {
    created.push(
      store.addMemory({
        memoryId: newId(),
        ownerId,
        type: "RELATIONSHIP",
        subtype: fact.category,
        content: fact.content,
        normalizedFact: normalizeFact(fact.content),
        createdAt: at,
        eventTimePrecision: "unknown",
        learnedAt: at,
        lastConfirmedAt: at,
        confidence: fact.confidence ?? "KNOWN",
        importance: fact.importance ?? 0.8,
        emotionalWeight: 0.4,
        sensitivity: "private",
        status: "active",
        relatedPeople: [],
        relatedProjects: [],
        relatedEvents: [],
        tags: ["seed", fact.category],
        provenance: "SYSTEM_SEED",
      }).memoryId,
    );
  }

  for (const person of seed.people ?? []) {
    store.upsertPerson({
      personId: newId(),
      ownerId,
      name: person.name,
      aliases: person.aliases ?? [],
      relationshipToOwner: person.relationshipToOwner,
      relevantContext: person.relevantContext,
      importantEventIds: [],
      projectIds: [],
      lastMentioned: at,
      confidence: person.confidence ?? "KNOWN",
      status: "active",
      createdAt: at,
      updatedAt: at,
    });
  }

  for (const project of seed.projects ?? []) {
    store.upsertProject({
      projectId: newId(),
      ownerId,
      name: project.name,
      aliases: project.aliases ?? [],
      description: project.description,
      status: project.status ?? "active",
      importantPeople: [],
      currentGoal: project.currentGoal,
      latestUpdate: project.description,
      openQuestions: [],
      lastUpdated: at,
      createdAt: at,
    });
  }

  for (const preference of seed.preferences ?? []) {
    created.push(
      store.addMemory({
        memoryId: newId(),
        ownerId,
        type: "PREFERENCE",
        content: preference.content,
        normalizedFact: normalizeFact(preference.content),
        createdAt: at,
        eventTimePrecision: "unknown",
        learnedAt: at,
        lastConfirmedAt: at,
        confidence: preference.confidence ?? "KNOWN",
        importance: 0.6,
        emotionalWeight: 0.1,
        sensitivity: "normal",
        status: "active",
        relatedPeople: [],
        relatedProjects: [],
        relatedEvents: [],
        tags: ["seed", "preference"],
        provenance: "SYSTEM_SEED",
      }).memoryId,
    );
  }

  for (const event of seed.events ?? []) {
    const memory = store.addMemory({
      memoryId: newId(),
      ownerId,
      type: "EPISODIC",
      content: event.content,
      normalizedFact: normalizeFact(event.content),
      createdAt: at,
      eventTime: event.occurredAt ?? null,
      eventTimePrecision: event.precision ?? (event.occurredAt ? "exact" : "unknown"),
      learnedAt: at,
      lastConfirmedAt: at,
      confidence: event.confidence ?? "KNOWN",
      importance: 0.7,
      emotionalWeight: 0.5,
      sensitivity: "private",
      status: "active",
      relatedPeople: [],
      relatedProjects: [],
      relatedEvents: [],
      tags: ["seed", "event"],
      provenance: "SYSTEM_SEED",
    });
    store.addTimelineEvent({
      eventId: newId(),
      ownerId,
      title: "seed-event",
      summary: event.content,
      occurredAt: event.occurredAt ?? null,
      precision: event.precision ?? "unknown",
      memoryIds: [memory.memoryId],
      createdAt: at,
    });
    created.push(memory.memoryId);
  }

  for (const matter of seed.ongoingMatters ?? []) {
    store.upsertOpenLoop({
      openLoopId: newId(),
      ownerId,
      description: matter.content,
      createdAt: at,
      dueAt: null,
      status: "open",
      importance: matter.importance ?? 0.6,
      lastDiscussed: at,
    });
  }

  if (seed.communicationStyle) {
    const state = store.getRelationshipState(ownerId);
    if (state) {
      store.saveRelationshipState({
        ...state,
        languageStyle: seed.communicationStyle.languages?.includes("hi") ? "hinglish" : state.languageStyle,
        updatedAt: at,
      });
    }
  }

  return { created: created.length };
}

function renderMarkdown(snapshot: MayaStoreSnapshot) {
  const lines = ["# Maya Memory Export", ""];
  lines.push("## People", ...snapshot.people.map((person) => `- ${person.name} (${person.relationshipToOwner ?? "unknown"})`), "");
  lines.push("## Projects", ...snapshot.projects.map((project) => `- ${project.name} [${project.status}] ${project.latestUpdate ?? ""}`), "");
  lines.push("## Open loops", ...snapshot.openLoops.map((loop) => `- [${loop.status}] ${loop.description}`), "");
  lines.push("## Timeline", ...snapshot.timeline.map((event) => `- ${event.occurredAt ?? "date unknown"} — ${event.summary}`), "");
  lines.push(
    "## Memories",
    ...snapshot.memories
      .filter((memory) => memory.status === "active" || memory.status === "uncertain")
      .map((memory) => `- (${memory.confidence}/${memory.type}) ${memory.content}`),
  );
  return lines.join("\n");
}
