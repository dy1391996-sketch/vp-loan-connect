import { z } from "zod";

const optionalUrl = z.string().url().optional().or(z.literal(""));

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  REPORT_SIGNING_SECRET: z.string().min(32),
  PAYMENT_PROVIDER: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.enum(["mock", "razorpay"]))
    .default("mock"),
  RAZORPAY_KEY_ID: z.string().trim().optional().default(""),
  RAZORPAY_KEY_SECRET: z.string().trim().optional().default(""),
  RAZORPAY_WEBHOOK_SECRET: z.string().trim().optional().default(""),
  WHATSAPP_PROVIDER: z.enum(["mock", "meta"]).default("mock"),
  WHATSAPP_API_URL: optionalUrl,
  WHATSAPP_ACCESS_TOKEN: z.string().optional().default(""),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(""),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional().default(""),
  WHATSAPP_APP_SECRET: z.string().optional().default(""),
  OTP_PROVIDER: z.enum(["mock", "custom"]).default("mock"),
  OTP_API_URL: optionalUrl,
  OTP_API_KEY: z.string().optional().default(""),
  MOCK_OTP_CODE: z.string().regex(/^\d{6}$/).default("123456"),
  STORE_CONSENT_IP: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  BUSINESS_NAME: z.string().default("VP Loan Connect"),
  BUSINESS_GSTIN: z.string().optional().default(""),
  BUSINESS_ADDRESS: z.string().optional().default(""),
  SUPPORT_EMAIL: z.string().email(),
  SUPPORT_WHATSAPP: z.string().optional().default(""),
  GRIEVANCE_NAME: z.string().optional().default(""),
  GRIEVANCE_EMAIL: z.string().email().optional().or(z.literal("")),
  ANALYTICS_ID: z.string().optional().default(""),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

const requiredBuildValues: Array<keyof ServerEnv> = [
  "DATABASE_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXTAUTH_SECRET",
  "REPORT_SIGNING_SECRET",
  "BUSINESS_NAME",
  "SUPPORT_EMAIL",
];

const requiredProductionValues: Array<keyof ServerEnv> = [
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "WHATSAPP_API_URL",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
  "WHATSAPP_APP_SECRET",
  "OTP_API_URL",
  "OTP_API_KEY",
  "BUSINESS_GSTIN",
  "BUSINESS_ADDRESS",
  "SUPPORT_WHATSAPP",
  "GRIEVANCE_NAME",
  "GRIEVANCE_EMAIL",
];

export function validateBuildEnvironment(environment: NodeJS.ProcessEnv): ServerEnv {
  const parsed = serverEnvSchema.safeParse({ ...environment, NODE_ENV: "production" });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ");
    throw new Error(`Invalid build environment: ${issues}`);
  }

  const config = parsed.data;
  const missing = requiredBuildValues.filter((key) => String(config[key] ?? "").trim().length === 0);
  if (missing.length) throw new Error(`Missing build environment variables: ${missing.join(", ")}`);
  if (!config.NEXT_PUBLIC_APP_URL.startsWith("https://")) throw new Error("NEXT_PUBLIC_APP_URL must use HTTPS in production.");
  return config;
}

export function validateProductionEnvironment(environment: NodeJS.ProcessEnv): ServerEnv {
  const config = validateBuildEnvironment(environment);
  const missing = requiredProductionValues.filter((key) => String(config[key] ?? "").trim().length === 0);
  if (missing.length) throw new Error(`Missing production environment variables: ${missing.join(", ")}`);
  if (config.PAYMENT_PROVIDER !== "razorpay") throw new Error("PAYMENT_PROVIDER must be razorpay in production.");
  if (config.OTP_PROVIDER !== "custom") throw new Error("OTP_PROVIDER must be custom in production.");
  if (config.WHATSAPP_PROVIDER !== "meta") throw new Error("WHATSAPP_PROVIDER must be meta in production.");
  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(config.BUSINESS_GSTIN)) throw new Error("BUSINESS_GSTIN must use the official 15-character format.");
  if (!/^\+?[1-9]\d{9,14}$/.test(config.SUPPORT_WHATSAPP)) throw new Error("SUPPORT_WHATSAPP must be in international format.");
  return config;
}

export function validateRuntimeEnvironment(environment: NodeJS.ProcessEnv): ServerEnv {
  const parsed = serverEnvSchema.safeParse(environment);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ");
    throw new Error(`Invalid server environment: ${issues}`);
  }

  return parsed.data.NODE_ENV === "production" ? validateBuildEnvironment(environment) : parsed.data;
}

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  cached = validateRuntimeEnvironment(process.env);
  return cached;
}

export function getPublicAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
