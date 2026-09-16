import type { MayaChannel, MayaDebugInfo, MayaTurnResult, WriteDecision } from "./types";
import { compileMayaContext, contextSources } from "./compiler";
import { retrieveRelevantContext } from "./retrieval";
import { newId, nowIso, type MayaStore } from "./store";
import { runWritePipeline } from "./write-pipeline";
import { defaultRelationshipState } from "./state";
import type { MayaLLMProvider } from "./providers/types";
import { contextToMessages } from "./providers/types";
import { createMockMayaProvider } from "./providers/mock";

export interface MayaBrainOptions {
  store: MayaStore;
  provider?: MayaLLMProvider;
  now?: () => Date;
  debug?: boolean;
}

export class MayaBrain {
  constructor(private readonly options: MayaBrainOptions) {}

  get store() {
    return this.options.store;
  }

  async respond(input: {
    ownerId: string;
    channel: MayaChannel;
    text: string;
    conversationId?: string;
    ownerAuthorized: boolean;
    senderId?: string;
  }): Promise<MayaTurnResult> {
    const started = Date.now();
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
      const generated = await provider.generate({
        context,
        messages: contextToMessages(context, [{ role: "user", content: input.text }]),
      });
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

    const conversation =
      (input.conversationId ? this.store.getConversation(input.ownerId, input.conversationId) : undefined) ??
      this.store.createConversation({
        conversationId: input.conversationId ?? newId(),
        ownerId: input.ownerId,
        channel: input.channel,
        createdAt: at,
        updatedAt: at,
        roleplayActive: false,
      });

    const userMessage = this.store.addMessage({
      messageId: newId(),
      conversationId: conversation.conversationId,
      ownerId: input.ownerId,
      role: "owner",
      channel: input.channel,
      text: input.text,
      createdAt: at,
      roleplay: conversation.roleplayActive,
    });

    const write = runWritePipeline(this.store, {
      ownerId: input.ownerId,
      conversationId: conversation.conversationId,
      messageId: userMessage.messageId,
      text: input.text,
      channel: input.channel,
      roleplayActive: conversation.roleplayActive,
      now,
    });

    const retrieved = retrieveRelevantContext(this.store, {
      ownerId: input.ownerId,
      utterance: input.text,
      conversationId: conversation.conversationId,
    });
    const context = compileMayaContext({
      store: this.store,
      ownerId: input.ownerId,
      conversationId: conversation.conversationId,
      utterance: input.text,
      channel: input.channel,
      ownerAuthorized: true,
    });
    const provider = this.options.provider ?? createMockMayaProvider();
    const generated = await provider.generate({
      context,
      messages: contextToMessages(context, [{ role: "user", content: input.text }]),
    });

    const reply = this.store.addMessage({
      messageId: newId(),
      conversationId: conversation.conversationId,
      ownerId: input.ownerId,
      role: "maya",
      channel: input.channel,
      text: generated.text,
      createdAt: nowIso(this.options.now?.() ?? new Date()),
      roleplay: conversation.roleplayActive,
    });

    const debug: MayaDebugInfo = {
      retrievedMemoryIds: retrieved.ranked.map((row) => row.memory.memoryId),
      retrievalScores: retrieved.ranked.map((row) => ({ memoryId: row.memory.memoryId, score: row.score, reasons: row.reasons })),
      contextSource: contextSources(context),
      writeDecisions: [write],
      conflictDecisions: conflictNotes(write),
      modelProvider: generated.provider,
      latencyMs: Date.now() - started,
    };

    return {
      conversationId: conversation.conversationId,
      messageId: reply.messageId,
      text: generated.text,
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
