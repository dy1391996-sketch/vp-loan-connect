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

export function contextToMessages(context: CompiledContext, extra: LLMMessage[] = []): LLMMessage[] {
  const history = context.recentMessages.map((message) => ({
    role: message.role === "maya" ? ("assistant" as const) : ("user" as const),
    content: message.text,
  }));
  return [{ role: "system", content: context.system }, ...history, ...extra];
}
