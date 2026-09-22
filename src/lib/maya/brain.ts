import { isMediaRequest, handleMediaChat } from "./media/chat";
import type { MayaChannel, MayaDebugInfo, MayaTurnResult, WriteDecision } from "./types";
import { compileMayaContext, contextSources } from "./compiler";
import { newId, nowIso, type MayaStore } from "./store";
import { runWritePipeline } from "./write-pipeline";
import { defaultRelationshipState } from "./state";
import type { MayaLLMProvider } from "./providers/types";
import { groundAssistantReply } from "./grounding";
import { contextToMessages } from "./providers/types";
import { createMockMayaProvider } from "./providers/mock";

export interface MayaBrainOptions {
  store: MayaStore;
  provider?: MayaLLMProvider;
  now?: () => Date;
  debug?: boolean;
}

export interface MayaRespondOptions {
  signal?: AbortSignal;
  onToken?: (token: string) => void;
}

export class MayaBrain {
  constructor(private readonly options: MayaBrainOptions) {}

  get store() {
    return this.options.store;
  }

  async respond(
    input: {
      ownerId: string;
      channel: MayaChannel;
      text: string;
      conversationId?: string;
      ownerAuthorized: boolean;
      senderId?: string;
    },
    respondOptions?: MayaRespondOptions,
  ): Promise<MayaTurnResult> {
    const started = Date.now();
    const phaseMs: NonNullable<MayaDebugInfo["phaseMs"]> = {};
    const now = this.options.now?.() ?? new Date();
    const at = nowIso(now);

    if (!input.ownerAuthorized) {
      const provider = this.options.provider ?? createMockMayaProvider();
      const context = compileMayaContext({
        store: this.store,
        ownerId: input.ownerId,
        conversationId: "public",
        utterance: input.text,
        channel: input.channel,
        ownerAuthorized: false,
      });
      const generated = await provider.generate(
        {
          context,
          messages: contextToMessages(context, [{ role: "user", content: input.text }]),
        },
        { signal: respondOptions?.signal, onToken: respondOptions?.onToken },
      );
      return {
        conversationId: "public",
        messageId: newId(),
        text: generated.text,
        ownerAuthorized: false,
        debug: this.options.debug
          ? {
              retrievedMemoryIds: [],
              retrievalScores: [],
              contextSource: contextSources(context),
              writeDecisions: [],
              conflictDecisions: [],
              modelProvider: generated.provider,
              latencyMs: Date.now() - started,
              usage: generated.usage,
            }
          : undefined,
      };
    }

    if (!this.store.getOwner(input.ownerId)) {
      throw new Error("OWNER_NOT_FOUND");
    }
    if (!this.store.getRelationshipState(input.ownerId)) {
      this.store.saveRelationshipState(defaultRelationshipState(input.ownerId, at));
    }

    // An explicit conversation id must stay on that thread. Only omit-id turns
    // continue the latest open conversation on this channel.
    const existing = input.conversationId
      ? this.store.getConversation(input.ownerId, input.conversationId)
      : this.store.listConversations(input.ownerId).find((row) => row.channel === input.channel && !row.closedAt);

    const conversation =
      existing ??
      this.store.createConversation({
        conversationId: input.conversationId ?? newId(),
        ownerId: input.ownerId,
        channel: input.channel,
        createdAt: at,
        updatedAt: at,
        roleplayActive: false,
      });

    const visualRequest = isMediaRequest(input.text);
    const userMessage = this.store.addMessage({
      messageId: newId(),
      conversationId: conversation.conversationId,
      ownerId: input.ownerId,
      role: "owner",
      channel: input.channel,
      text: input.text,
      createdAt: at,
      roleplay: visualRequest || conversation.roleplayActive,
    });

    // Visual requests never enter factual memory extraction or model invention.
    if (visualRequest) {
      const text = await handleMediaChat(input.ownerId, input.text);
      const reply = this.store.addMessage({ messageId: newId(), conversationId: conversation.conversationId, ownerId: input.ownerId, role: "maya", channel: input.channel, text, createdAt: nowIso(), roleplay: true });
      respondOptions?.onToken?.(text);
      return { conversationId: conversation.conversationId, messageId: reply.messageId, text, ownerAuthorized: true };
    }

    const writeStarted = Date.now();
    const write = runWritePipeline(this.store, {
      ownerId: input.ownerId,
      conversationId: conversation.conversationId,
      messageId: userMessage.messageId,
      text: input.text,
      channel: input.channel,
      roleplayActive: conversation.roleplayActive,
      now,
    });
    phaseMs.writePipeline = Date.now() - writeStarted;

    const compileStarted = Date.now();
    const context = compileMayaContext({
      store: this.store,
      ownerId: input.ownerId,
      conversationId: conversation.conversationId,
      utterance: input.text,
      channel: input.channel,
      ownerAuthorized: true,
    });
    phaseMs.compile = Date.now() - compileStarted;

    const provider = this.options.provider ?? createMockMayaProvider();
    const modelStarted = Date.now();
    const generated = await provider.generate(
      {
        context,
        messages: contextToMessages(context, [{ role: "user", content: input.text }]),
      },
      { signal: respondOptions?.signal, onToken: respondOptions?.onToken },
    );
    phaseMs.model = Date.now() - modelStarted;

    if (respondOptions?.signal?.aborted) {
      const aborted = new Error("Aborted");
      aborted.name = "AbortError";
      throw aborted;
    }

    const persistStarted = Date.now();
    const factualCorpus = [
      ...context.recentMessages.filter((message) => message.role === "owner").map((message) => message.text),
      input.text,
      ...context.memories.map((memory) => memory.content),
    ].join("\n");
    const groundedText = groundAssistantReply(generated.text, factualCorpus, input.text);

    // Exactly-once persistence of the final grounded reply (not streamed partials).
    const reply = this.store.addMessage({
      messageId: newId(),
      conversationId: conversation.conversationId,
      ownerId: input.ownerId,
      role: "maya",
      channel: input.channel,
      text: groundedText,
      createdAt: nowIso(this.options.now?.() ?? new Date()),
      roleplay: conversation.roleplayActive,
    });
    phaseMs.groundPersist = Date.now() - persistStarted;

    const debug: MayaDebugInfo = {
      retrievedMemoryIds: context.memories.map((memory) => memory.memoryId),
      retrievalScores: context.memories.map((memory) => ({
        memoryId: memory.memoryId,
        score: 0,
        reasons: ["compiled"],
      })),
      contextSource: contextSources(context),
      writeDecisions: [write],
      conflictDecisions: conflictNotes(write),
      modelProvider: generated.provider,
      latencyMs: Date.now() - started,
      phaseMs,
      usage: generated.usage,
    };

    return {
      conversationId: conversation.conversationId,
      messageId: reply.messageId,
      text: groundedText,
      ownerAuthorized: true,
      debug: this.options.debug ? debug : undefined,
    };
  }
}

function conflictNotes(write: WriteDecision) {
  const notes: string[] = [];
  if (write.duplicateOf) notes.push(`duplicate:${write.duplicateOf}`);
  if (write.contradicted) notes.push(`superseded:${write.contradicted}`);
  if (write.roleplayBlocked) notes.push("roleplay_blocked");
  return notes;
}
