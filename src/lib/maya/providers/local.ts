import type { MayaLLMProvider } from "./types";

export function createLocalMayaProvider(
  options?: {
    baseUrl?: string;
    model?: string;
  },
): MayaLLMProvider {
  const baseUrl = (
    options?.baseUrl ||
    process.env.MAYA_LOCAL_LLM_BASE_URL ||
    "http://127.0.0.1:11434"
  ).replace(/\/+$/, "");

  const model =
    options?.model ||
    process.env.MAYA_LLM_MODEL ||
    "qwen3:4b-instruct";

  return {
    id: "local",

    async generate(input) {
      const messages = [
        {
          role: "system" as const,
          content: input.context.system,
        },
        ...input.messages.filter((message) => message.role !== "system"),
      ];

      const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          stream: false,
          messages,
          options: {
            temperature: 0.45,
            top_p: 0.85,
            repeat_penalty: 1.18,
            num_ctx: 8192,
          },
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(
          `Local Maya provider failed (${response.status}): ${detail.slice(0, 500)}`,
        );
      }

      const data = (await response.json()) as {
        message?: {
          content?: string;
        };
      };

      const text = (data.message?.content ?? "")
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .trim();

      if (!text) {
        throw new Error("Local Maya provider returned an empty response");
      }

      return {
        text,
        provider: "local",
        model,
      };
    },
  };
}
