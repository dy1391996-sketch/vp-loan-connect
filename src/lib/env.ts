import { z } from "zod";

const boolish = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  CRON_SECRET: z.string().min(8),
  HOLD_MINUTES: z.coerce.number().int().min(5).max(120).default(15),
  TOKEN_PERCENT: z.coerce.number().int().min(10).max(100).default(30),
  PAYMENT_PROVIDER: z.enum(["mock", "razorpay"]).default("mock"),
  RAZORPAY_KEY_ID: z.string().optional().default(""),
  RAZORPAY_KEY_SECRET: z.string().optional().default(""),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(""),
  WHATSAPP_PROVIDER: z.enum(["mock", "meta"]).default("mock"),
  WHATSAPP_API_URL: z.string().optional().default("https://graph.facebook.com/v22.0"),
  WHATSAPP_ACCESS_TOKEN: z.string().optional().default(""),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(""),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional().default(""),
  WHATSAPP_APP_SECRET: z.string().optional().default(""),
  INSTAGRAM_PROVIDER: z.enum(["mock", "meta"]).default("mock"),
  INSTAGRAM_ACCESS_TOKEN: z.string().optional().default(""),
  INSTAGRAM_BUSINESS_ACCOUNT_ID: z.string().optional().default(""),
  INSTAGRAM_PAGE_ID: z.string().optional().default(""),
  OPENAI_PROVIDER: z.enum(["mock", "openai"]).default("mock"),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().optional().default("gpt-4.1-mini"),
  MEDIA_PROVIDER: z.enum(["mock", "cloudinary", "vercel_blob"]).default("mock"),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(""),
  CLOUDINARY_API_KEY: z.string().optional().default(""),
  CLOUDINARY_API_SECRET: z.string().optional().default(""),
  BLOB_READ_WRITE_TOKEN: z.string().optional().default(""),
  REDIS_URL: z.string().optional().default(""),
  ADMIN_EMAIL: z.string().optional().default(""),
  ADMIN_INITIAL_PASSWORD: z.string().optional().default(""),
  BUSINESS_NAME: z.string().default("VP Nest – The Studio99Stay"),
  BUSINESS_LEGAL_NAME: z.string().optional().default(""),
  BUSINESS_ADDRESS: z.string().optional().default("Gaur City Center, Greater Noida West"),
  SUPPORT_EMAIL: z.string().optional().default(""),
  SUPPORT_WHATSAPP: z.string().optional().default(""),
  GOOGLE_REVIEW_URL: z.string().optional().default(""),
  PROPERTY_LOCATION_URL: z.string().optional().default(""),
  PROPERTY_MAPS_PIN: z.string().optional().default(""),
  STORE_CONSENT_IP: boolish,
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${details}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === "production") {
    if (env.PAYMENT_PROVIDER === "mock") throw new Error("Mock payments are disabled in production.");
    if (env.WHATSAPP_PROVIDER === "mock") throw new Error("Mock WhatsApp is disabled in production.");
    if (env.OPENAI_PROVIDER === "mock") throw new Error("Mock OpenAI is disabled in production.");
  }
  cached = env;
  return env;
}

export function resetEnvCache() {
  cached = null;
}
