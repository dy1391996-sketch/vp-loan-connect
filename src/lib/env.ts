import { z } from "zod";

const optionalUrl = z.string().url().optional().or(z.literal(""));
const trimSecret = z
  .string()
  .optional()
  .default("")
  .transform((value) => value.trim().replace(/^['"]|['"]$/g, "").trim());

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
    .pipe(z.enum(["mock", "razorpay", "cashfree", "phonepe", "payu"]))
    .default("mock"),
  RAZORPAY_KEY_ID: trimSecret,
  RAZORPAY_KEY_SECRET: trimSecret,
  RAZORPAY_WEBHOOK_SECRET: trimSecret,
  CASHFREE_APP_ID: trimSecret,
  CASHFREE_SECRET_KEY: trimSecret,
  CASHFREE_WEBHOOK_SECRET: trimSecret,
  /** Optional override; Cashfree PG default is 2025-01-01. */
  CASHFREE_API_VERSION: z
    .string()
    .trim()
    .optional()
    .default("")
    .transform((value) => value.trim().replace(/^['"]|['"]$/g, "").trim()),
  CASHFREE_ENV: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.enum(["sandbox", "production"]))
    .default("sandbox"),
  PHONEPE_MERCHANT_ID: trimSecret,
  PHONEPE_SALT_KEY: trimSecret,
  PHONEPE_SALT_INDEX: z
    .string()
    .optional()
    .default("1")
    .transform((value) => value.trim().replace(/^['"]|['"]$/g, "").trim() || "1"),
  PHONEPE_ENV: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.enum(["sandbox", "production"]))
    .default("sandbox"),
  PAYU_KEY: trimSecret,
  PAYU_SALT: trimSecret,
  PAYU_ENV: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.enum(["test", "production"]))
    .default("test"),
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
export type PaymentProviderId = ServerEnv["PAYMENT_PROVIDER"];

const requiredBuildValues: Array<keyof ServerEnv> = [
  "DATABASE_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXTAUTH_SECRET",
  "REPORT_SIGNING_SECRET",
  "BUSINESS_NAME",
  "SUPPORT_EMAIL",
];

const requiredProductionBaseValues: Array<keyof ServerEnv> = [
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

export function missingPaymentCredentialKeys(config: ServerEnv): string[] {
  switch (config.PAYMENT_PROVIDER) {
    case "razorpay":
      return [
        !config.RAZORPAY_KEY_ID ? "RAZORPAY_KEY_ID" : "",
        !config.RAZORPAY_KEY_SECRET ? "RAZORPAY_KEY_SECRET" : "",
        !config.RAZORPAY_WEBHOOK_SECRET ? "RAZORPAY_WEBHOOK_SECRET" : "",
      ].filter(Boolean);
    case "cashfree":
      return [!config.CASHFREE_APP_ID ? "CASHFREE_APP_ID" : "", !config.CASHFREE_SECRET_KEY ? "CASHFREE_SECRET_KEY" : ""].filter(Boolean);
    case "phonepe":
      return [
        !config.PHONEPE_MERCHANT_ID ? "PHONEPE_MERCHANT_ID" : "",
        !config.PHONEPE_SALT_KEY ? "PHONEPE_SALT_KEY" : "",
        !config.PHONEPE_SALT_INDEX ? "PHONEPE_SALT_INDEX" : "",
      ].filter(Boolean);
    case "payu":
      return [!config.PAYU_KEY ? "PAYU_KEY" : "", !config.PAYU_SALT ? "PAYU_SALT" : ""].filter(Boolean);
    case "mock":
      return [];
    default:
      return ["PAYMENT_PROVIDER"];
  }
}

/** Checkout/create-order credentials only. Webhook secrets fail closed at webhook handlers. */
export function missingCheckoutPaymentCredentialKeys(config: ServerEnv): string[] {
  return missingPaymentCredentialKeys(config).filter((key) => key !== "RAZORPAY_WEBHOOK_SECRET" && key !== "CASHFREE_WEBHOOK_SECRET");
}

/** Cashfree docs also use CLIENT_ID / CLIENT_SECRET; map them onto APP_ID / SECRET_KEY without exposing secrets. */
export function normalizePaymentEnvironmentAliases(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const next = { ...environment };
  const appId = String(next.CASHFREE_APP_ID ?? "").trim();
  const clientId = String(next.CASHFREE_CLIENT_ID ?? "").trim();
  if (!appId && clientId) next.CASHFREE_APP_ID = clientId;

  const secret = String(next.CASHFREE_SECRET_KEY ?? "").trim();
  const clientSecret = String(next.CASHFREE_CLIENT_SECRET ?? "").trim();
  if (!secret && clientSecret) next.CASHFREE_SECRET_KEY = clientSecret;

  return next;
}

const PLACEHOLDER_SECRET_PATTERN =
  /^(changeme|replace_me|your[_-]?secret|xxx+|placeholder|sample|test[_-]?key|dummy)$/i;

export function looksLikePlaceholderCredential(value: string | undefined) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return false;
  return PLACEHOLDER_SECRET_PATTERN.test(trimmed) || trimmed.includes("YOUR_") || trimmed.includes("<<<");
}

export function validateBuildEnvironment(environment: NodeJS.ProcessEnv): ServerEnv {
  const normalized = normalizePaymentEnvironmentAliases(environment);
  const parsed = serverEnvSchema.safeParse({ ...normalized, NODE_ENV: "production" });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ");
    throw new Error(`Invalid build environment: ${issues}`);
  }

  const config = parsed.data;
  const missing = requiredBuildValues.filter((key) => String(config[key] ?? "").trim().length === 0);
  if (missing.length) throw new Error(`Missing build environment variables: ${missing.join(", ")}`);
  if (!config.NEXT_PUBLIC_APP_URL.startsWith("https://")) throw new Error("NEXT_PUBLIC_APP_URL must use HTTPS in production.");
  try {
    const host = new URL(config.NEXT_PUBLIC_APP_URL).hostname.toLowerCase();
    if (host === "vploanconnect.in") {
      console.warn(
        "[env] NEXT_PUBLIC_APP_URL uses apex host. Canonical links are normalized to https://www.vploanconnect.in — set NEXT_PUBLIC_APP_URL=https://www.vploanconnect.in in Vercel.",
      );
    }
  } catch {
    /* schema already validates URL shape */
  }
  return config;
}

/**
 * Critical production gate for payments + OTP (always enforced at runtime/prebuild on Vercel production).
 * Does NOT require WhatsApp Meta / GSTIN / grievance — those fail closed at provider call-sites when unconfigured.
 * Razorpay webhook secret is recommended but not a build blocker; webhook route rejects unsigned events.
 */
export function validateCriticalProductionEnvironment(environment: NodeJS.ProcessEnv): ServerEnv {
  const config = validateBuildEnvironment(environment);
  if (config.PAYMENT_PROVIDER === "mock") {
    throw new Error("PAYMENT_PROVIDER must be razorpay, cashfree, phonepe, or payu in production.");
  }
  const paymentMissing = missingCheckoutPaymentCredentialKeys(config);
  if (paymentMissing.length) {
    throw new Error(`Missing ${config.PAYMENT_PROVIDER} payment credentials: ${paymentMissing.join(", ")}`);
  }
  if (config.PAYMENT_PROVIDER === "razorpay") {
    if (looksLikePlaceholderCredential(config.RAZORPAY_KEY_ID) || looksLikePlaceholderCredential(config.RAZORPAY_KEY_SECRET)) {
      throw new Error("RAZORPAY credentials look like placeholders. Set real live keys in Vercel Production.");
    }
    if (!config.RAZORPAY_WEBHOOK_SECRET) {
      console.warn(
        "[env] RAZORPAY_WEBHOOK_SECRET is not set. Checkout can still verify client signatures; configure the webhook secret in Vercel so /api/webhooks/razorpay can accept events.",
      );
    }
  }
  if (config.PAYMENT_PROVIDER === "cashfree") {
    if (config.CASHFREE_ENV !== "production") {
      throw new Error("CASHFREE_ENV must be production when PAYMENT_PROVIDER=cashfree in production.");
    }
    if (looksLikePlaceholderCredential(config.CASHFREE_APP_ID) || looksLikePlaceholderCredential(config.CASHFREE_SECRET_KEY)) {
      throw new Error("CASHFREE credentials look like placeholders. Set real production App ID and Secret Key in Vercel.");
    }
    if (!config.CASHFREE_WEBHOOK_SECRET) {
      console.warn(
        "[env] CASHFREE_WEBHOOK_SECRET is unset; Cashfree webhooks will verify using CASHFREE_SECRET_KEY (official PG client secret).",
      );
    }
  }
  if (config.OTP_PROVIDER !== "custom") throw new Error("OTP_PROVIDER must be custom in production.");
  if (!String(config.OTP_API_URL ?? "").trim() || !String(config.OTP_API_KEY ?? "").trim()) {
    throw new Error("OTP_API_URL and OTP_API_KEY are required in production.");
  }
  const widgetId = String(environment.NEXT_PUBLIC_MSG91_WIDGET_ID ?? "").trim();
  const widgetToken = String(environment.NEXT_PUBLIC_MSG91_WIDGET_TOKEN ?? "").trim();
  if (!widgetId || !widgetToken) {
    throw new Error("NEXT_PUBLIC_MSG91_WIDGET_ID and NEXT_PUBLIC_MSG91_WIDGET_TOKEN are required in production for email OTP.");
  }
  return config;
}

/** Full production checklist (legal identity + WhatsApp Meta + webhook secrets). Use when the business stack is fully configured. */
export function validateProductionEnvironment(environment: NodeJS.ProcessEnv): ServerEnv {
  const config = validateCriticalProductionEnvironment(environment);
  const missing = requiredProductionBaseValues.filter((key) => String(config[key] ?? "").trim().length === 0);
  if (missing.length) throw new Error(`Missing production environment variables: ${missing.join(", ")}`);
  const webhookMissing = missingPaymentCredentialKeys(config).filter((key) => key.includes("WEBHOOK"));
  if (webhookMissing.length) {
    throw new Error(`Missing ${config.PAYMENT_PROVIDER} webhook credentials: ${webhookMissing.join(", ")}`);
  }
  if (config.WHATSAPP_PROVIDER !== "meta") throw new Error("WHATSAPP_PROVIDER must be meta in production.");
  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(config.BUSINESS_GSTIN)) throw new Error("BUSINESS_GSTIN must use the official 15-character format.");
  if (!/^\+?[1-9]\d{9,14}$/.test(config.SUPPORT_WHATSAPP)) throw new Error("SUPPORT_WHATSAPP must be in international format.");
  return config;
}

export function validateRuntimeEnvironment(environment: NodeJS.ProcessEnv): ServerEnv {
  const normalized = normalizePaymentEnvironmentAliases(environment);
  const parsed = serverEnvSchema.safeParse(normalized);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ");
    throw new Error(`Invalid server environment: ${issues}`);
  }

  if (parsed.data.NODE_ENV !== "production") return parsed.data;

  // Enforce live payment + OTP on Vercel Production (and when VALIDATE_PRODUCTION_ENV=true).
  // Local `next build` stays on soft build checks so incomplete local env does not break CI tooling.
  if (normalized.VERCEL_ENV === "production" || normalized.VALIDATE_PRODUCTION_ENV === "true") {
    return validateCriticalProductionEnvironment(normalized);
  }
  return validateBuildEnvironment(normalized);
}

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  cached = validateRuntimeEnvironment(process.env);
  return cached;
}

/** Test-only: clear cached env after mutating process.env in unit tests. */
export function resetServerEnvCacheForTests() {
  cached = undefined;
}

/** Production canonical origin for VP Loan Connect (www). */
export const CANONICAL_PUBLIC_ORIGIN = "https://www.vploanconnect.in";

/**
 * Normalize public app URLs so apex and trailing slashes cannot fork SEO/payment links.
 * `vploanconnect.in` → `www.vploanconnect.in`; paths are discarded (origin only).
 */
export function normalizePublicAppUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  try {
    const url = new URL(trimmed);
    if (url.hostname.toLowerCase() === "vploanconnect.in") {
      url.hostname = "www.vploanconnect.in";
    }
    return url.origin;
  } catch {
    return trimmed || CANONICAL_PUBLIC_ORIGIN;
  }
}

export function getPublicAppUrl() {
  return resolvePublicAppUrl(process.env.NEXT_PUBLIC_APP_URL, process.env.NODE_ENV);
}

/** Pure helper for URL resolution — used by getPublicAppUrl and unit tests. */
export function resolvePublicAppUrl(raw: string | undefined, nodeEnv: string | undefined = process.env.NODE_ENV) {
  const fallback = nodeEnv === "production" ? CANONICAL_PUBLIC_ORIGIN : "http://localhost:3000";
  const normalized = normalizePublicAppUrl(raw ?? fallback);

  // Never emit localhost/http origins from production server code (misconfigured env must not fork SEO/payment links).
  if (nodeEnv === "production") {
    try {
      const url = new URL(normalized);
      const host = url.hostname.toLowerCase();
      if (url.protocol !== "https:" || host === "localhost" || host === "127.0.0.1") {
        return CANONICAL_PUBLIC_ORIGIN;
      }
    } catch {
      return CANONICAL_PUBLIC_ORIGIN;
    }
  }

  return normalized;
}
