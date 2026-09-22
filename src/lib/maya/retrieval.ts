import type { MayaMemory, MayaPerson, MayaProject, RetrievedMemory } from "./types";
import type { MayaStore } from "./store";
import { HISTORICAL_PROVENANCE } from "./types";
import { contentTokens, focusRecentMessages, looksLikeExplicitRecall, meaningfulOverlap } from "./topic-focus";

export interface RetrievalInput {
  ownerId: string;
  utterance: string;
  conversationId?: string;
  limit?: number;
}

export function retrieveRelevantContext(store: MayaStore, input: RetrievalInput) {
  const limit = Math.min(input.limit ?? 4, 4);
  const now = Date.now();
  const people = matchPeople(store, input.ownerId, input.utterance);
  const projects = matchProjects(store, input.ownerId, input.utterance);
  const loops = relevantLoops(store.listOpenLoops(input.ownerId, ["open", "waiting"]), input.utterance);
  const explicitRecall = looksLikeExplicitRecall(input.utterance);
  const memories = store
    .listMemories({ ownerId: input.ownerId, status: ["active", "uncertain"], limit: 400 })
    .filter((memory) => HISTORICAL_PROVENANCE.includes(memory.provenance) || memory.type === "CONVERSATION_SUMMARY");

  const ranked: RetrievedMemory[] = memories
    .map((memory) => scoreMemory(memory, input, people, projects, loops.map((loop) => loop.relatedMemoryId), now, explicitRecall))
    // Relevance is mandatory. Entity/recency alone used to flood call/VP Nest facts into unrelated turns.
    .filter((row) => row.score > 0 && row.reasons.includes("relevance"))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const recentMessages = input.conversationId ? store.listMessages(input.ownerId, input.conversationId, 16) : [];
  const trimmedRecent = focusRecentMessages(recentMessages, input.utterance);
  const relationshipState = store.getRelationshipState(input.ownerId);
  const timeline = store.listTimeline(input.ownerId).slice(0, 4);

  return {
    ranked,
    people,
    projects,
    loops: loops.slice(0, 2),
    recentMessages: trimmedRecent,
    relationshipState,
    timeline,
  };
}

function scoreMemory(
  memory: MayaMemory,
  input: RetrievalInput,
  people: MayaPerson[],
  projects: MayaProject[],
  unresolvedIds: Array<string | null | undefined>,
  now: number,
  explicitRecall: boolean,
): RetrievedMemory {
  const reasons: string[] = [];
  const relevance = meaningfulOverlap(memory.content, input.utterance);
  const isSummary = memory.type === "CONVERSATION_SUMMARY";
  // Summaries are noisy (often Maya monologue). Only inject on strong overlap or explicit recall.
  const relevanceFloor = isSummary ? (explicitRecall ? 0.18 : 0.28) : explicitRecall ? 0.1 : 0.16;
  if (relevance >= relevanceFloor) reasons.push("relevance");

  // Clock-bearing memories need a shared topic noun (call/doctor/…) — not just "kitne baje?".
  if (reasons.includes("relevance") && memoryHasClock(memory.content) && !clockTopicAligned(memory.content, input.utterance) && !explicitRecall) {
    const idx = reasons.indexOf("relevance");
    if (idx >= 0) reasons.splice(idx, 1);
  }

  const ageDays = Math.max(0, (now - Date.parse(memory.createdAt)) / 86_400_000);
  const recency = Math.exp(-ageDays / 21);
  if (recency > 0.5) reasons.push("recency");
  const importance = memory.importance;
  if (importance >= 0.6) reasons.push("importance");
  const relationship = memory.type === "RELATIONSHIP" || memory.type === "EMOTIONAL" ? 0.8 : 0.2;
  const entity =
    people.some((person) => memory.relatedPeople.includes(person.personId) || memory.content.toLowerCase().includes(person.name.toLowerCase())) ||
    projects.some((project) => memory.relatedProjects.includes(project.projectId) || memory.content.toLowerCase().includes(project.name.toLowerCase()))
      ? 1
      : 0;
  if (entity) reasons.push("entity");
  const unresolved = unresolvedIds.includes(memory.memoryId) ? 1 : 0;
  if (unresolved) reasons.push("unresolved");

  // Without relevance/entity, score must stay 0 so recency/importance alone cannot force injection.
  if (!reasons.includes("relevance") && !reasons.includes("entity")) {
    return { memory, score: 0, reasons };
  }

  const score =
    relevance * 0.55 +
    (isSummary ? 0 : recency * 0.1) +
    importance * 0.15 +
    relationship * 0.05 +
    entity * 0.1 +
    unresolved * 0.05;
  return { memory, score, reasons };
}

function relevantLoops(loops: ReturnType<MayaStore["listOpenLoops"]>, utterance: string) {
  return loops.filter((loop) => meaningfulOverlap(loop.description, utterance) >= 0.16);
}

const CLOCK_TOPIC =
  /\b(call|meeting|appointment|doctor|client|interview|flight|train|bus|class|school|office|chai|birthday|party|wedding)\b/i;

function memoryHasClock(text: string) {
  return /\b\d{1,2}[:.]\d{2}\b|\b\d{1,2}\s*(?:am|pm|baje)\b/i.test(text);
}

function clockTopicAligned(memoryText: string, utterance: string) {
  const memTopics = memoryText.match(CLOCK_TOPIC) || [];
  const askTopics = utterance.match(CLOCK_TOPIC) || [];
  if (!memTopics.length || !askTopics.length) return false;
  const ask = new Set(askTopics.map((t) => t.toLowerCase()));
  return memTopics.some((t) => ask.has(t.toLowerCase()));
}

function matchPeople(store: MayaStore, ownerId: string, utterance: string) {
  const tokens = new Set(contentTokens(utterance));
  return store.listPeople(ownerId).filter((person) => {
    const names = [person.name, ...person.aliases].map((value) => value.toLowerCase());
    return names.some((name) => utterance.toLowerCase().includes(name) || tokens.has(name));
  });
}

function matchProjects(store: MayaStore, ownerId: string, utterance: string) {
  return store.listProjects(ownerId).filter((project) => {
    const names = [project.name, ...project.aliases].map((value) => value.toLowerCase());
    return names.some((name) => utterance.toLowerCase().includes(name)) || (project.description && meaningfulOverlap(project.description, utterance) > 0.25);
  });
}

export function formatNaturalRecallHint(memory: MayaMemory) {
  if (memory.confidence === "UNCERTAIN" || memory.confidence === "UNKNOWN") {
    return `uncertain:${memory.content}`;
  }
  if (memory.confidence === "LIKELY") return `likely:${memory.content}`;
  return `known:${memory.content}`;
}
