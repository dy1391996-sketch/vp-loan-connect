import { z } from "zod";

const schema = z.object({
  MAYA_OWNER_ID: z.string().optional().default(""),
  MAYA_OWNER_EMAIL: z.string().email().optional().or(z.literal("")).default(""),
  MAYA_OWNER_PASSWORD: z.string().optional().default(""),
  MAYA_OWNER_PASSWORD_HASH: z.string().optional().default(""),
  MAYA_LLM_PROVIDER: z.enum(["mock", "openai", "anthropic"]).default("mock"),
  MAYA_LLM_MODEL: z.string().optional().default(""),
  MAYA_OPENAI_API_KEY: z.string().optional().default(""),
  MAYA_OPENAI_BASE_URL: z.string().optional().default(""),
  MAYA_ANTHROPIC_API_KEY: z.string().optional().default(""),
  MAYA_STORE: z.enum(["prisma", "memory"]).default("prisma"),
  MAYA_DEBUG: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  MAYA_INSTAGRAM_OWNER_IDS: z.string().optional().default(""),
  INSTAGRAM_WEBHOOK_VERIFY_TOKEN: z.string().optional().default(""),
  INSTAGRAM_APP_SECRET: z.string().optional().default(""),
  INSTAGRAM_PAGE_ACCESS_TOKEN: z.string().optional().default(""),
  INSTAGRAM_GRAPH_API_URL: z.string().optional().default("https://graph.facebook.com/v22.0"),
});

export type MayaEnv = z.infer<typeof schema>;

let cached: MayaEnv | undefined;

export function getMayaEnv(environment: NodeJS.ProcessEnv = process.env): MayaEnv {
  if (cached && environment === process.env) return cached;
  const parsed = schema.parse({
    MAYA_OWNER_ID: environment.MAYA_OWNER_ID ?? "",
    MAYA_OWNER_EMAIL: environment.MAYA_OWNER_EMAIL ?? "",
    MAYA_OWNER_PASSWORD: environment.MAYA_OWNER_PASSWORD ?? "",
    MAYA_OWNER_PASSWORD_HASH: environment.MAYA_OWNER_PASSWORD_HASH ?? "",
    MAYA_LLM_PROVIDER: environment.MAYA_LLM_PROVIDER || "mock",
    MAYA_LLM_MODEL: environment.MAYA_LLM_MODEL ?? "",
    MAYA_OPENAI_API_KEY: environment.MAYA_OPENAI_API_KEY ?? "",
    MAYA_OPENAI_BASE_URL: environment.MAYA_OPENAI_BASE_URL ?? "",
    MAYA_ANTHROPIC_API_KEY: environment.MAYA_ANTHROPIC_API_KEY ?? "",
    MAYA_STORE: environment.MAYA_STORE || "prisma",
    MAYA_DEBUG: environment.MAYA_DEBUG ?? "false",
    MAYA_INSTAGRAM_OWNER_IDS: environment.MAYA_INSTAGRAM_OWNER_IDS ?? "",
    INSTAGRAM_WEBHOOK_VERIFY_TOKEN: environment.INSTAGRAM_WEBHOOK_VERIFY_TOKEN ?? "",
    INSTAGRAM_APP_SECRET: environment.INSTAGRAM_APP_SECRET ?? "",
    INSTAGRAM_PAGE_ACCESS_TOKEN: environment.INSTAGRAM_PAGE_ACCESS_TOKEN ?? "",
    INSTAGRAM_GRAPH_API_URL: environment.INSTAGRAM_GRAPH_API_URL ?? "https://graph.facebook.com/v22.0",
  });
  if (environment === process.env) cached = parsed;
  return parsed;
}

export function resetMayaEnvCacheForTests() {
  cached = undefined;
}

export function instagramOwnerAllowlist(env = getMayaEnv()) {
  return env.MAYA_INSTAGRAM_OWNER_IDS.split(/[\s,]+/).map((value) => value.trim()).filter(Boolean);
}

export function isInstagramOwner(senderId: string, env = getMayaEnv()) {
  return instagramOwnerAllowlist(env).includes(senderId);
}
