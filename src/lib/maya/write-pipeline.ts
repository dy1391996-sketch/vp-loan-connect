import type { AffectionMode, MayaChannel, MayaMemory, MayaRelationshipState, WriteDecision } from "./types";
import {
  classifyMemoryType,
  classifyProvenance,
  estimateConfidence,
  estimateImportance,
  extractLikelyPersonNames,
  extractProjectName,
  isCorrectionUtterance,
  isForgetUtterance,
  isRoleplayUtterance,
  looksLikeOpenLoop,
  normalizeFact,
  ownerReportedMood,
  shouldPersist,
  tokenOverlap,
} from "./classify";
import { findRelatedMemory, supersedeMemory } from "./contradiction";
import { newId, nowIso, type MayaStore } from "./store";
import { defaultRelationshipState } from "./state";

export interface WritePipelineInput {
  ownerId: string;
  conversationId: string;
  messageId: string;
  text: string;
  channel: MayaChannel;
  roleplayActive: boolean;
  now?: Date;
}

export function runWritePipeline(store: MayaStore, input: WritePipelineInput): WriteDecision {
  const at = nowIso(input.now);
  const provenance = classifyProvenance(input.text, input.roleplayActive);
  const importance = estimateImportance(input.text);
  const decisions: WriteDecision = {
    stored: false,
    reason: "transient",
    memoryIds: [],
    roleplayBlocked: provenance === "ROLEPLAY" || provenance === "FICTION",
  };

  updateConversationState(store, input, at);

  if (isForgetUtterance(input.text)) {
    const target = findCorrectionTarget(store, input.ownerId, input.text);
    if (target) {
      store.deleteMemory(input.ownerId, target.memoryId, at);
      decisions.reason = "deleted";
      decisions.memoryIds.push(target.memoryId);
    }
    return decisions;
  }

  if (isCorrectionUtterance(input.text)) {
    const replacement = stripCorrectionWrapper(input.text);
    const target = findCorrectionTarget(store, input.ownerId, replacement || input.text);
    if (target && replacement) {
      const corrected = createMemory(store, input, {
        type: target.type,
        content: replacement,
        provenance: "REAL_USER_REPORTED",
        importance: Math.max(target.importance, 0.7),
        at,
      });
      supersedeMemory(store, input.ownerId, target, corrected, at);
      decisions.stored = true;
      decisions.reason = "corrected";
      decisions.contradicted = target.memoryId;
      decisions.memoryIds.push(corrected.memoryId);
      return decisions;
    }
  }

  if (!shouldPersist(input.text, provenance, importance)) {
    decisions.reason = decisions.roleplayBlocked ? "roleplay_not_historical" : "not_durable";
    return decisions;
  }

  const type = classifyMemoryType(input.text);
  const candidate = {
    type,
    content: input.text.trim(),
    normalizedFact: normalizeFact(input.text),
  };
  const related = findRelatedMemory(store, input.ownerId, candidate);
  if (related.kind === "duplicate" && related.existing) {
    store.updateMemory(input.ownerId, related.existing.memoryId, { lastConfirmedAt: at });
    decisions.reason = "duplicate";
    decisions.duplicateOf = related.existing.memoryId;
    return decisions;
  }

  const memory = createMemory(store, input, {
    type,
    content: input.text.trim(),
    provenance,
    importance,
    at,
    confidence: estimateConfidence(input.text),
  });

  if (related.kind === "contradiction" && related.existing) {
    supersedeMemory(store, input.ownerId, related.existing, memory, at);
    decisions.contradicted = related.existing.memoryId;
    decisions.reason = "superseded";
  } else {
    store.addMemory(memory);
    decisions.reason = "stored";
  }

  decisions.stored = true;
  decisions.memoryIds.push(memory.memoryId);
  linkPeopleAndProjects(store, input.ownerId, memory, at);
  maybeOpenLoop(store, input, memory, at);
  store.addTimelineEvent({
    eventId: newId(),
    ownerId: input.ownerId,
    title: memory.type.toLowerCase(),
    summary: memory.content.slice(0, 180),
    occurredAt: memory.eventTime,
    precision: memory.eventTimePrecision,
    memoryIds: [memory.memoryId],
    createdAt: at,
  });
  refreshConversationSummary(store, input.ownerId, input.conversationId, at);
  return decisions;
}

function createMemory(
  store: MayaStore,
  input: WritePipelineInput,
  options: {
    type: MayaMemory["type"];
    content: string;
    provenance: MayaMemory["provenance"];
    importance: number;
    at: string;
    confidence?: MayaMemory["confidence"];
  },
): MayaMemory {
  return {
    memoryId: newId(),
    ownerId: input.ownerId,
    type: options.type,
    content: options.content,
    normalizedFact: normalizeFact(options.content),
    sourceConversationId: input.conversationId,
    sourceMessageId: input.messageId,
    createdAt: options.at,
    eventTime: null,
    eventTimePrecision: "unknown",
    learnedAt: options.at,
    lastConfirmedAt: options.at,
    confidence: options.confidence ?? estimateConfidence(options.content),
    importance: options.importance,
    emotionalWeight: options.importance >= 0.75 ? 0.6 : 0.2,
    sensitivity: "normal",
    status: options.confidence === "UNCERTAIN" ? "uncertain" : "active",
    supersededBy: null,
    relatedPeople: [],
    relatedProjects: [],
    relatedEvents: [],
    tags: [input.channel],
    provenance: options.provenance,
  };
}

function linkPeopleAndProjects(store: MayaStore, ownerId: string, memory: MayaMemory, at: string) {
  for (const name of extractLikelyPersonNames(memory.content)) {
    let person = store.findPersonByName(ownerId, name);
    if (!person) {
      person = store.upsertPerson({
        personId: newId(),
        ownerId,
        name,
        aliases: [],
        importantEventIds: [],
        projectIds: [],
        lastMentioned: at,
        confidence: memory.confidence,
        status: "active",
        createdAt: at,
        updatedAt: at,
      });
    } else {
      person.lastMentioned = at;
      person.updatedAt = at;
      store.upsertPerson(person);
    }
    memory.relatedPeople.push(person.personId);
  }

  const projectName = extractProjectName(memory.content);
  if (projectName) {
    let project = store.findProjectByName(ownerId, projectName);
    if (!project) {
      project = store.upsertProject({
        projectId: newId(),
        ownerId,
        name: projectName,
        aliases: [],
        description: memory.content,
        status: /complete|done|हो गया/.test(memory.content) ? "completed" : "active",
        importantPeople: memory.relatedPeople,
        latestUpdate: memory.content,
        openQuestions: [],
        lastUpdated: at,
        createdAt: at,
      });
    } else {
      project.latestUpdate = memory.content;
      project.lastUpdated = at;
      if (/complete|done|हो गया|finished/.test(memory.content)) project.status = "completed";
      store.upsertProject(project);
    }
    memory.relatedProjects.push(project.projectId);
  }
}

function maybeOpenLoop(store: MayaStore, input: WritePipelineInput, memory: MayaMemory, at: string) {
  if (!looksLikeOpenLoop(input.text)) return;
  store.upsertOpenLoop({
    openLoopId: newId(),
    ownerId: input.ownerId,
    description: input.text.trim(),
    createdAt: at,
    dueAt: null,
    status: "open",
    importance: memory.importance,
    relatedMemoryId: memory.memoryId,
    lastDiscussed: at,
  });
}

function findCorrectionTarget(store: MayaStore, ownerId: string, text: string) {
  const active = store.listMemories({ ownerId, status: ["active", "uncertain"], limit: 100 });
  if (!active.length) return undefined;
  return [...active].sort((a, b) => tokenOverlap(b.content, text) - tokenOverlap(a.content, text))[0];
}

function stripCorrectionWrapper(text: string) {
  return text
    .replace(/ये गलत याद है[.!]*/i, "")
    .replace(/इसको update करो[:\s]*/i, "")
    .replace(/ये अब पुरानी बात है[.!]*/i, "")
    .replace(/\b(that's wrong|correct that|update that)[:\s]*/i, "")
    .trim();
}

function isGreetingOrAck(text: string) {
  const trimmed = text.trim();
  return (
    trimmed.length <= 40 &&
    /^(hi+|hello|hey(\s+baby)?|yo|hola|namaste|kaise\s*ho|kya\s*haal|ok+|okay|hmm+|haan|han|theek|thanks|thank you|ty|i love u+|love you|miss you)\s*[.!?❤️🫀]*$/i.test(
      trimmed,
    )
  );
}

function looksLikeAssistantPrompt(text: string) {
  return /\b(batao\.\.\.|aapki duniya|kaise laga\?|what do you want to discuss|how can i help)\b/i.test(text);
}

function nextUnfinishedTopic(current: string | null | undefined, text: string) {
  if (isGreetingOrAck(text)) return null;
  if (looksLikeAssistantPrompt(text)) return current ?? null;
  // Clear forced unfinished topics when the owner clearly changes subject.
  if (current && looksLikeSubjectChange(current, text)) {
    return text.trim().length > 40 ? text.slice(0, 160) : null;
  }
  if (text.trim().length > 40) return text.slice(0, 160);
  return current ?? null;
}

function looksLikeSubjectChange(previous: string, text: string) {
  const prev = previous.toLowerCase();
  const next = text.toLowerCase();
  if (/\b(kitne\s*baje|yaad|remember|woh\s+call|that\s+call)\b/i.test(next)) return false;
  const markers = [
    /\brent\b|\bsalary\b|\bpercent\b|\bhisab\b/,
    /\bchai\b|\belaichi\b|\badrak\b/,
    /\bcall\b|\bmeeting\b|\bappointment\b/,
    /\bthak\b|\btired\b|\bthak\s*gaya\b/,
  ];
  const prevHits = markers.map((pattern) => pattern.test(prev));
  const nextHits = markers.map((pattern) => pattern.test(next));
  if (nextHits.some(Boolean) && prevHits.some(Boolean)) {
    return nextHits.findIndex(Boolean) !== prevHits.findIndex(Boolean);
  }
  return false;
}

function updateConversationState(store: MayaStore, input: WritePipelineInput, at: string) {
  const current = store.getRelationshipState(input.ownerId) ?? defaultRelationshipState(input.ownerId, at);
  const mood = ownerReportedMood(input.text);
  const practicalShift =
    /\b(rent|salary|percent|hisab|calculate|call|meeting|appointment|doctor|chai|fees?|price|amount)\b/i.test(input.text) &&
    !/\b(thak|tired|sad|udaas|gussa|feel|feeling|mood)\b/i.test(input.text);
  const next: MayaRelationshipState = {
    ...current,
    // Clear sticky tired/low mood once the owner moves to a practical topic.
    ownerReportedMood: mood ?? (practicalShift ? null : current.ownerReportedMood),
    conversationTone: mood === "low" || mood === "frustrated" ? "careful" : mood === "upbeat" ? "warm" : practicalShift ? "neutral" : current.conversationTone,
    affectionContext: pickAffection(input.text, current.affectionContext),
    seriousness: /payment|business|serious|problem/.test(input.text) ? 0.7 : Math.max(0.2, current.seriousness - 0.05),
    playfulness: /joke|mazak|hehe|😂/.test(input.text) ? 0.7 : Math.max(0.15, current.playfulness - 0.04),
    unfinishedTopic: nextUnfinishedTopic(current.unfinishedTopic, input.text),
    languageStyle: detectLanguageStyle(input.text, current.languageStyle),
    updatedAt: at,
  };
  if (isRoleplayUtterance(input.text)) {
    store.updateConversation(input.ownerId, input.conversationId, { roleplayActive: true, updatedAt: at });
  } else {
    store.updateConversation(input.ownerId, input.conversationId, { updatedAt: at });
  }
  store.saveRelationshipState(next);
}

function pickAffection(text: string, previous: AffectionMode): AffectionMode {
  if (/miss you|love you|pyaar|i love u/.test(text)) return "romantic";
  if (/sad|down|hurt|udaas/.test(text)) return "comforting";
  if (/joke|tease|mazak/.test(text)) return "teasing";
  if (/did it|ho gaya|cracked/.test(text)) return "proud";
  if (/payment|business|deadline/.test(text)) return "serious";
  // Practical topic shifts should not keep a prior "comforting" cling.
  if (/\b(rent|salary|percent|hisab|calculate|call|meeting|appointment|doctor|chai)\b/i.test(text)) {
    return "gentle";
  }
  return previous === "romantic" ? "gentle" : previous;
}

function detectLanguageStyle(text: string, previous: string) {
  if (/[\u0900-\u097F]/.test(text)) return "hinglish";
  if (/\b(hai|ho|kya|nahi|yar|acha|theek|batao|kaise|mere|tera|tum)\b/i.test(text)) return "hinglish";
  if (/^[a-zA-Z0-9\s'",.!?-]+$/.test(text) && text.trim().split(/\s+/).length >= 4) return "english";
  return previous;
}

function refreshConversationSummary(store: MayaStore, ownerId: string, conversationId: string, at: string) {
  const messages = store.listMessages(ownerId, conversationId, 12);
  if (messages.length < 4) return;
  const summary = messages
    .slice(-8)
    .map((message) => `${message.role}: ${message.text}`)
    .join(" | ")
    .slice(0, 500);
  store.addMemory({
    memoryId: newId(),
    ownerId,
    type: "CONVERSATION_SUMMARY",
    content: summary,
    normalizedFact: normalizeFact(summary),
    sourceConversationId: conversationId,
    createdAt: at,
    eventTimePrecision: "unknown",
    learnedAt: at,
    lastConfirmedAt: at,
    confidence: "LIKELY",
    importance: 0.4,
    emotionalWeight: 0.1,
    sensitivity: "normal",
    status: "active",
    relatedPeople: [],
    relatedProjects: [],
    relatedEvents: [],
    tags: ["summary"],
    provenance: "REAL_CONVERSATION",
  });
  const state = store.getRelationshipState(ownerId);
  if (state) store.saveRelationshipState({ ...state, lastConversationSummary: summary, updatedAt: at });
}
