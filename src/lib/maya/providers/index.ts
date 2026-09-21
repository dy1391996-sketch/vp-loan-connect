import { createLocalMayaProvider } from "./local";
import { createMockMayaProvider } from "./mock";
import { createAnthropicProvider, createOpenAIProvider } from "./remote";
import type { MayaLLMProvider } from "./types";
import { getMayaEnv } from "../env";

export type { MayaLLMProvider } from "./types";
export { contextToMessages } from "./types";
export { createMockMayaProvider } from "./mock";
export { createOpenAIProvider, createAnthropicProvider } from "./remote";

export function createMayaProvider(id = getMayaEnv().MAYA_LLM_PROVIDER): MayaLLMProvider {
  if (id === "local") {
    const env = getMayaEnv();
    return createLocalMayaProvider({
      model: env.MAYA_LLM_MODEL || undefined,
      baseUrl: process.env.MAYA_LOCAL_LLM_BASE_URL || undefined,
    });
  }

  const env = getMayaEnv();
  if (id === "openai") {
    if (!env.MAYA_OPENAI_API_KEY) throw new Error("MAYA_OPENAI_API_KEY is required for the openai provider.");
    return createOpenAIProvider({ apiKey: env.MAYA_OPENAI_API_KEY, model: env.MAYA_LLM_MODEL || undefined, baseUrl: env.MAYA_OPENAI_BASE_URL || undefined });
  }
  if (id === "anthropic") {
    if (!env.MAYA_ANTHROPIC_API_KEY) throw new Error("MAYA_ANTHROPIC_API_KEY is required for the anthropic provider.");
    return createAnthropicProvider({ apiKey: env.MAYA_ANTHROPIC_API_KEY, model: env.MAYA_LLM_MODEL || undefined });
  }
  return createMockMayaProvider();
}
export { createLocalMayaProvider } from "./local";
