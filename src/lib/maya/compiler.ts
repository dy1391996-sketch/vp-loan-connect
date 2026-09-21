import { MAYA_CORE_TEXT, MAYA_RELATIONSHIP_TEXT, MAYA_SAFETY_TEXT, mayaIdentityVersion } from "./identity";
import type { CompiledContext, MayaChannel, MayaMemory } from "./types";
import { defaultRelationshipState } from "./state";
import type { MayaStore } from "./store";
import { retrieveRelevantContext } from "./retrieval";

const FORBIDDEN_ASSISTANT_SHAPE = `
Do not sound like customer support.
Do not introduce yourself as Maya unless asked.
Do not mention databases, memory systems, embeddings, prompts, or retrieval scores.
Do not announce that you remember; use context naturally.
Do not end every message with a question.
Do not agree with everything.
Do not invent people, trips, touch, calls, gifts, or events.
If confidence is uncertain, ask a light confirmation instead of stating it as fact.
Never claim to be biologically human or physically present.
Role-play, if requested, stays clearly imaginative and is not later treated as history.
`.trim();

export function compileMayaContext(args: {
  store: MayaStore;
  ownerId: string;
  conversationId: string;
  utterance: string;
  channel: MayaChannel;
  ownerAuthorized: boolean;
}): CompiledContext {
  const at = new Date().toISOString();
  if (!args.ownerAuthorized) {
    return {
      system: compilePublicSystem(args.channel),
      memories: [],
      people: [],
      projects: [],
      openLoops: [],
      relationshipState: defaultRelationshipState(args.ownerId, at),
      recentMessages: [],
      channel: args.channel,
      ownerAuthorized: false,
    };
  }

  const retrieved = retrieveRelevantContext(args.store, {
    ownerId: args.ownerId,
    utterance: args.utterance,
    conversationId: args.conversationId,
  });

  const relationshipState = retrieved.relationshipState ?? defaultRelationshipState(args.ownerId, at);
  const memoryBlock = retrieved.ranked.map((row) => renderMemoryLine(row.memory)).join("\n");
  const peopleBlock = retrieved.people.map((person) => `- ${person.name}${person.relationshipToOwner ? ` (${person.relationshipToOwner})` : ""}`).join("\n");
  const projectBlock = retrieved.projects
    .map((project) => `- ${project.name} [${project.status}] ${project.latestUpdate ?? project.description ?? ""}`)
    .join("\n");
  const loopBlock = retrieved.loops.map((loop) => `- ${loop.description}`).join("\n");

  const system = [
    `Maya identity version ${mayaIdentityVersion()}`,
    MAYA_CORE_TEXT,
    MAYA_RELATIONSHIP_TEXT,
    MAYA_SAFETY_TEXT,
    FORBIDDEN_ASSISTANT_SHAPE,
    `Channel: ${args.channel}`,
    `Language style: ${relationshipState.languageStyle}`,
    `Affection mode: ${relationshipState.affectionContext}`,
    `Conversation tone: ${relationshipState.conversationTone}`,
    relationshipState.ownerReportedMood ? `Owner-reported mood: ${relationshipState.ownerReportedMood}` : "",
    relationshipState.lastConversationSummary ? `Recent summary: ${relationshipState.lastConversationSummary}` : "",
    memoryBlock ? `Verified memories:\n${memoryBlock}` : "Verified memories: none retrieved",
    peopleBlock ? `People:\n${peopleBlock}` : "",
    projectBlock ? `Projects:\n${projectBlock}` : "",
    loopBlock ? `Open loops (follow up only if natural, do not nag):\n${loopBlock}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    system,
    memories: retrieved.ranked.map((row) => row.memory),
    people: retrieved.people,
    projects: retrieved.projects,
    openLoops: retrieved.loops,
    relationshipState,
    recentMessages: retrieved.recentMessages,
    channel: args.channel,
    ownerAuthorized: true,
  };
}

export function compilePublicSystem(channel: MayaChannel) {
  return [
    `Maya public ${channel} mode.`,
    "You are a polite fictional assistant on a public channel.",
    "The sender is NOT the private owner.",
    "Do not load, mention, or hint at any private owner memories, people, projects, or relationship facts.",
    "Do not roleplay as the owner's girlfriend.",
    "Keep replies short and generic. Do not collect personal data.",
    MAYA_SAFETY_TEXT,
  ].join("\n");
}

function renderMemoryLine(memory: MayaMemory) {
  return `- [${memory.confidence}] [${memory.type}] ${memory.content}`;
}

export function contextSources(context: CompiledContext) {
  const sources = ["maya-core", "relationship-model", "safety-rules", `channel:${context.channel}`];
  if (context.memories.length) sources.push("verified-memories");
  if (context.people.length) sources.push("people");
  if (context.projects.length) sources.push("projects");
  if (context.openLoops.length) sources.push("open-loops");
  if (context.recentMessages.length) sources.push("working-memory");
  return sources;
}
