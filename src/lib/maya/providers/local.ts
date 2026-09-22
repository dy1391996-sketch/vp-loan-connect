import type { MayaLLMProvider, LLMGenerateInput, LLMGenerateOptions, LLMGenerateResult } from "./types";

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

    async generate(input: LLMGenerateInput, options?: LLMGenerateOptions): Promise<LLMGenerateResult> {
      const messages = [
        {
          role: "system" as const,
          content: input.context.system,
        },
        ...input.messages.filter((message) => message.role !== "system"),
      ];
      const lastUser = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
      const trimmedUser = lastUser.trim();
      const wantsDetail = /\b(explain|detail|kyun|why|how|steps|list|compare|calculate|percent|hisab)\b/i.test(trimmedUser);
      const isBrief =
        trimmedUser.length <= 40 &&
        /^(hi+|hello|hey(\s+baby)?|yo|hola|namaste|kaise\s*ho|kya\s*haal|ok+|okay|hmm+|haan|theek|thanks|i love u+|love you)\s*[.!?]*$/i.test(
          trimmedUser,
        );
      // Usable length without monologues. Avoid the 36-token chop that made replies feel broken.
      const numPredict = wantsDetail ? 140 : isBrief ? 64 : trimmedUser.length < 100 ? 96 : 120;

      const body = {
        model,
        stream: Boolean(options?.onToken),
        keep_alive: "30m",
        messages,
        options: {
          // 8GB M1: 8192 was slow; 2048 truncated identity (~1.5k tokens) and ruined Hinglish.
          // 4096 fits identity + recent turns without the old swap spiral.
          temperature: wantsDetail ? 0.5 : 0.42,
          top_p: 0.85,
          repeat_penalty: 1.12,
          num_ctx: 4096,
          num_predict: numPredict,
        },
      };

      const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal: options?.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Local Maya provider failed (${response.status}): ${detail.slice(0, 500)}`);
      }

      if (!options?.onToken) {
        const data = (await response.json()) as OllamaChatResponse;
        return finalize(data, model);
      }

      if (!response.body) {
        throw new Error("Local Maya provider returned no stream body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let text = "";
      let lastMeta: OllamaChatResponse | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let chunk: OllamaChatResponse;
          try {
            chunk = JSON.parse(trimmed) as OllamaChatResponse;
          } catch {
            continue;
          }
          lastMeta = chunk;
          const piece = chunk.message?.content ?? "";
          if (piece) {
            text += piece;
            options.onToken(piece);
          }
        }
      }

      const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      if (!cleaned) throw new Error("Local Maya provider returned an empty response");
      return {
        text: cleaned,
        provider: "local",
        model,
        usage: usageFrom(lastMeta),
      };
    },
  };
}

type OllamaChatResponse = {
  message?: { content?: string };
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
};

function finalize(data: OllamaChatResponse, model: string): LLMGenerateResult {
  const text = (data.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (!text) throw new Error("Local Maya provider returned an empty response");
  return {
    text,
    provider: "local",
    model,
    usage: usageFrom(data),
  };
}

function usageFrom(data: OllamaChatResponse | null) {
  if (!data) return undefined;
  return {
    promptEvalCount: data.prompt_eval_count,
    evalCount: data.eval_count,
    totalDurationMs: data.total_duration ? Math.round(data.total_duration / 1e6) : undefined,
    loadDurationMs: data.load_duration ? Math.round(data.load_duration / 1e6) : undefined,
    promptEvalDurationMs: data.prompt_eval_duration ? Math.round(data.prompt_eval_duration / 1e6) : undefined,
    evalDurationMs: data.eval_duration ? Math.round(data.eval_duration / 1e6) : undefined,
  };
}
