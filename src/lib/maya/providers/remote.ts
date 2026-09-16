import type { CompiledContext } from "../types";
import type { MayaLLMProvider } from "./types";

export function createOpenAIProvider(options: { apiKey: string; model?: string; baseUrl?: string }): MayaLLMProvider {
  const model = options.model || "gpt-4.1-mini";
  const baseUrl = (options.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  return {
    id: "openai",
    async generate({ context, messages }) {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${options.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0.7,
          messages: [{ role: "system", content: context.system }, ...messages.filter((message) => message.role !== "system")],
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error("OPENAI_PROVIDER_REJECTED");
      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error("OPENAI_EMPTY_RESPONSE");
      return { text, provider: "openai", model };
    },
  };
}

export function createAnthropicProvider(options: { apiKey: string; model?: string }): MayaLLMProvider {
  const model = options.model || "claude-sonnet-4-5";
  return {
    id: "anthropic",
    async generate({ context, messages }: { context: CompiledContext; messages: Array<{ role: "system" | "user" | "assistant"; content: string }> }) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": options.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 800,
          system: context.system,
          messages: messages.filter((message) => message.role !== "system").map((message) => ({ role: message.role, content: message.content })),
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error("ANTHROPIC_PROVIDER_REJECTED");
      const data = (await response.json()) as { content?: Array<{ text?: string }> };
      const text = data.content?.map((block) => block.text ?? "").join("").trim();
      if (!text) throw new Error("ANTHROPIC_EMPTY_RESPONSE");
      return { text, provider: "anthropic", model };
    },
  };
}
