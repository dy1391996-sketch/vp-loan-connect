import type { MayaMemory, MayaPerson, MayaProject, RetrievedMemory } from "./types";
import { tokenOverlap, tokenize } from "./classify";
import type { MayaStore } from "./store";
import { HISTORICAL_PROVENANCE } from "./types";

export interface RetrievalInput {
  ownerId: string;
  utterance: string;
  conversationId?: string;
  limit?: number;
}

export function retrieveRelevantContext(store: MayaStore, input: RetrievalInput) {
  const limit = input.limit ?? 8;
  const now = Date.now();
  const people = matchPeople(store, input.ownerId, input.utterance);
  const projects = matchProjects(store, input.ownerId, input.utterance);
  const loops = store.listOpenLoops(input.ownerId, ["open", "waiting"]);
  const memories = store
    .listMemories({ ownerId: input.ownerId, status: ["active", "uncertain"], limit: 400 })
    .filter((memory) => HISTORICAL_PROVENANCE.includes(memory.provenance) || memory.type === "CONVERSATION_SUMMARY");

  const ranked: RetrievedMemory[] = memories
    .map((memory) => scoreMemory(memory, input, people, projects, loops.map((loop) => loop.relatedMemoryId), now))
    .filter((row) => row.score > 0.12)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const recentMessages = input.conversationId ? store.listMessages(input.ownerId, input.conversationId, 12) : [];
  // Prefer the freshest turns; drop leading stale assistant monologues if the window is full of noise.
  const trimmedRecent = sanitizeRecentMessages(recentMessages);
  const relationshipState = store.getRelationshipState(input.ownerId);
  const timeline = store.listTimeline(input.ownerId).slice(0, 8);

  return {
    ranked,
    people,
    projects,
    loops: loops.slice(0, 6),
    recentMessages: trimmedRecent,
    relationshipState,
    timeline,
  };
}

function sanitizeRecentMessages(messages: ReturnType<MayaStore["listMessages"]>) {
  if (messages.length <= 8) return messages;
  // Keep the latest 8 turns for the local model context window / coherence.
  return messages.slice(-8);
}

function scoreMemory(
  memory: MayaMemory,
  input: RetrievalInput,
  people: MayaPerson[],
  projects: MayaProject[],
  unresolvedIds: Array<string | null | undefined>,
  now: number,
): RetrievedMemory {
  const reasons: string[] = [];
  const relevance = tokenOverlap(memory.content, input.utterance);
  if (relevance > 0) reasons.push("relevance");
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
  const score = relevance * 0.35 + recency * 0.2 + importance * 0.2 + relationship * 0.1 + entity * 0.1 + unresolved * 0.05;
  return { memory, score, reasons };
}

function matchPeople(store: MayaStore, ownerId: string, utterance: string) {
  const tokens = new Set(tokenize(utterance));
  return store.listPeople(ownerId).filter((person) => {
    const names = [person.name, ...person.aliases].map((value) => value.toLowerCase());
    return names.some((name) => utterance.toLowerCase().includes(name) || tokens.has(name));
  });
}

function matchProjects(store: MayaStore, ownerId: string, utterance: string) {
  return store.listProjects(ownerId).filter((project) => {
    const names = [project.name, ...project.aliases].map((value) => value.toLowerCase());
    return names.some((name) => utterance.toLowerCase().includes(name)) || (project.description && tokenOverlap(project.description, utterance) > 0.25);
  });
}

export function formatNaturalRecallHint(memory: MayaMemory) {
  if (memory.confidence === "UNCERTAIN" || memory.confidence === "UNKNOWN") {
    return `uncertain:${memory.content}`;
  }
  if (memory.confidence === "LIKELY") return `likely:${memory.content}`;
  return `known:${memory.content}`;
}
