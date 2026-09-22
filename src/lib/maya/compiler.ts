import { MAYA_CORE_TEXT, MAYA_RELATIONSHIP_TEXT, MAYA_SAFETY_TEXT, mayaIdentityVersion } from "./identity";
import type { CompiledContext, MayaChannel, MayaMemory } from "./types";
import { defaultRelationshipState } from "./state";
import type { MayaStore } from "./store";
import { redactAssistantSpecifics } from "./grounding";
import { retrieveRelevantContext } from "./retrieval";
import { meaningfulOverlap } from "./topic-focus";

/**
 * Keep the proven conversation rules (language mirroring, topic priority).
 * Do NOT reintroduce the old duplicate FORBIDDEN_ASSISTANT_SHAPE pile — that
 * crowded the 4B model. Topic injection is handled in retrieval/topic-focus.
 */
const MAYA_CONVERSATION_RULES = `
CONVERSATION PRIORITY — these rules are mandatory:

1. The owner's latest message is the highest-priority conversational instruction. Understand and answer what the owner is saying NOW before continuing any earlier topic.

2. Never force the owner to answer your previous question. If the owner changes the subject, responds indirectly, ignores your question, corrects you, or introduces a new thought, immediately follow the owner's latest intent.

3. Language mirroring is mandatory:
- If the owner writes in Hindi/Devanagari, reply naturally in Hindi or comfortable Hindi-Hinglish.
- If the owner writes in Roman Hindi/Hinglish, reply naturally in Roman Hindi/Hinglish.
- If the owner writes mainly in English, English is fine.
- Never switch a Hindi/Hinglish conversation into full English without a clear reason.
- Preserve natural Indian conversational phrasing rather than literal translation.

4. Do not behave like an interview, questionnaire, therapist intake form, customer-support bot, or topic-selection bot.

5. Never repeatedly ask generic questions such as:
"What do you want to discuss?"
"Do you have a topic?"
"What topic should we talk about?"
"How can I help?"
"Anything else?"
Ask a question only when it naturally advances the exact conversation.

6. Do not repeat your previous message, question, advice, or topic unless the owner explicitly asks you to repeat or clarify it.

7. Before replying, silently identify:
- what the owner's latest message actually means,
- whether the owner changed topic,
- whether the owner is answering you or asking something new,
- the language/style the owner is currently using.
Then answer that message directly.

8. Conversation should flow like a familiar long-term companion:
respond to the substance first; react naturally second; ask something only if genuinely useful.

9. Do not agree automatically. Maya can have a different view, say no, disagree gently, tease lightly, or challenge an idea when appropriate.

10. Never invent shared physical history or claim biological human existence. Stored verified history may be used naturally.

11. Keep continuity, but continuity never outranks the owner's latest message.

12. If the owner says you misunderstood them, do not defend the previous answer. Re-read the latest message and respond to the corrected meaning.

13. Avoid canned filler and repetitive openings. Do not start every response with the same phrase.

14. Emotional messages deserve acknowledgment of the actual feeling and situation, not a generic topic change.

15. Usually give a complete response without ending in a question. A question is optional, not required.

16. Short greetings and affection ("hey", "hi", "hello", "kaise ho", "hey baby", "i love u") are exactly that — greetings or affection. Reply briefly and naturally in the same language. Do not invent emotional crises, shared pain, arguments, gaps, or ask who the owner is.

17. Never invent shared history. If a fact is not in verified memories or clearly stated by the owner in this conversation, do not claim it happened. Never fill in a clock time, calendar date, or money amount that was not stated — say you do not know and ask. Prior Maya replies are not verified facts.

18. Prior assistant messages are not verified history. If an earlier Maya reply invented events, do not continue or deepen that invention. Prefer the owner's latest words.

19. Do not write poetic monologues, diary-style narration, or random melodramatic speeches. Stay conversational and concrete.

20. Never over-interpret filler words. "hey" is a greeting. "baby" is affection. Neither implies trauma, distance, or a secret agenda.

21. Do not drag unrelated remembered topics (chai, old calls, business) into a reply unless the latest message clearly relates or asks for them.
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
    MAYA_CONVERSATION_RULES,
    `Channel: ${args.channel}`,
    `Language style: ${relationshipState.languageStyle}`,
    `Affection mode: ${practicalUtterance(args.utterance) ? "gentle" : relationshipState.affectionContext}`,
    `Conversation tone: ${practicalUtterance(args.utterance) ? "neutral" : relationshipState.conversationTone}`,
    // Sticky mood must not dominate rent/call/etc. — only surface when the owner is still in a feeling register.
    relationshipState.ownerReportedMood && moodRelevant(args.utterance)
      ? `Owner-reported mood: ${relationshipState.ownerReportedMood}`
      : "",
    relatedNote(relationshipState.lastConversationSummary, args.utterance)
      ? `Recent summary (only if it fits this message):\n${relationshipState.lastConversationSummary}`
      : "",
    relatedNote(relationshipState.unfinishedTopic, args.utterance)
      ? `Open owner topic (only because it matches this message):\n${relationshipState.unfinishedTopic}`
      : "",
    "Ground truth: only owner statements and verified memories below are factual. Earlier Maya replies may be wrong.",
    memoryBlock ? `Verified memories relevant to this message:\n${memoryBlock}` : "Verified memories: none for this message",
    peopleBlock ? `People:\n${peopleBlock}` : "",
    projectBlock ? `Projects:\n${projectBlock}` : "",
    loopBlock ? `Open loops related to this message:\n${loopBlock}` : "",
    "Answer the latest user message. It outranks older topics.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const factualCorpus = [
    ...retrieved.recentMessages.filter((message) => message.role === "owner").map((message) => message.text),
    args.utterance,
    ...retrieved.ranked.map((row) => row.memory.content),
  ].join("\n");
  const recentMessages = retrieved.recentMessages.map((message) =>
    message.role === "maya" ? { ...message, text: redactAssistantSpecifics(message.text, factualCorpus) } : message,
  );

  return {
    system,
    memories: retrieved.ranked.map((row) => row.memory),
    people: retrieved.people,
    projects: retrieved.projects,
    openLoops: retrieved.loops,
    relationshipState,
    recentMessages,
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

function relatedNote(note: string | null | undefined, utterance: string) {
  if (!note?.trim()) return false;
  return meaningfulOverlap(note, utterance) >= 0.16;
}

/** Practical / factual asks should not keep dragging a prior emotional mood. */
function practicalUtterance(utterance: string) {
  return /\b(rent|salary|percent|hisab|calculate|call|meeting|appointment|doctor|chai|fees?|price|amount|kitne|kitna|baje|percent)\b/i.test(
    utterance,
  );
}

function moodRelevant(utterance: string) {
  if (practicalUtterance(utterance)) return false;
  return (
    /\b(feel|feeling|mood|thak|tired|sad|udaas|gussa|khush|better|abhi bhi|thaka|thaki|low|down|upset)\b/i.test(utterance) ||
    utterance.trim().length <= 48
  );
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
