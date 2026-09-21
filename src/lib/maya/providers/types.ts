import type { CompiledContext } from "../types";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMGenerateInput {
  context: CompiledContext;
  messages: LLMMessage[];
}

export interface LLMGenerateResult {
  text: string;
  provider: string;
  model: string;
}

export interface MayaLLMProvider {
  id: string;
  generate(input: LLMGenerateInput): Promise<LLMGenerateResult>;
}

/**
 * Build chat messages for the LLM.
 * Dedupes consecutive identical turns so the latest owner utterance is not
 * sent twice when it is already present in recentMessages.
 */
export function contextToMessages(context: CompiledContext, extra: LLMMessage[] = []): LLMMessage[] {
  const history: LLMMessage[] = [];

  const push = (role: LLMMessage["role"], raw: string) => {
    const content = raw.trim();
    if (!content || role === "system") return;
    const previous = history[history.length - 1];
    if (previous && previous.role === role && previous.content === content) return;
    history.push({ role, content });
  };

  for (const message of context.recentMessages) {
    push(message.role === "maya" ? "assistant" : "user", message.text);
  }

  for (const message of extra) {
    push(message.role, message.content);
  }

  return [{ role: "system", content: context.system }, ...history];
}
