import { getServerEnv } from "@/lib/env";
import { AI_SYSTEM_PROMPT } from "@/lib/constants";
import { redactPii } from "@/lib/utils";

export type ChatMessage = { role: "system" | "user" | "assistant" | "tool"; content: string; name?: string };

export async function runChatCompletion(input: {
  messages: ChatMessage[];
  tools?: unknown[];
  temperature?: number;
}) {
  const env = getServerEnv();
  const messages = [{ role: "system" as const, content: AI_SYSTEM_PROMPT }, ...input.messages];

  if (env.OPENAI_PROVIDER === "mock") {
    const lastUser = [...input.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    return {
      provider: "mock" as const,
      content: mockReply(lastUser),
      toolCalls: [] as { name: string; arguments: string }[],
    };
  }

  if (!env.OPENAI_API_KEY) throw new Error("OpenAI API key is not configured.");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      temperature: input.temperature ?? 0.4,
      messages: messages.map((m) => ({
        role: m.role,
        content: redactPii(m.content).slice(0, 8000),
        ...(m.name ? { name: m.name } : {}),
      })),
      tools: input.tools,
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) throw new Error(`OpenAI request failed (${response.status}).`);
  const data = (await response.json()) as {
    choices: {
      message: {
        content?: string;
        tool_calls?: { function: { name: string; arguments: string } }[];
      };
    }[];
  };
  const message = data.choices[0]?.message;
  return {
    provider: "openai" as const,
    content: message?.content ?? "",
    toolCalls: (message?.tool_calls ?? []).map((t) => ({
      name: t.function.name,
      arguments: t.function.arguments,
    })),
  };
}

function mockReply(userText: string) {
  const lower = userText.toLowerCase();
  if (lower.includes("price") || lower.includes("kitna") || lower.includes("rate")) {
    return "Pricing depends on date and duration. Please share your required date, check-in time, duration and number of guests — I’ll check live rates.";
  }
  if (lower.includes("location") || lower.includes("kahan")) {
    return "We are at Gaur City Center, Greater Noida West. Please share your date and duration so I can check available studios.";
  }
  if (lower.includes("human") || lower.includes("agent") || lower.includes("call")) {
    return "I’ll connect you with our team right away.";
  }
  return "Welcome to VP Nest – The Studio99Stay. Please share your required date and check-in time.";
}
