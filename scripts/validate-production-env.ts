/**
 * Production env gate for VP Nest AI Command Center.
 * Fails the build when critical production settings are unsafe.
 */
import { getServerEnv, resetEnvCache } from "../src/lib/env";

resetEnvCache();

try {
  const env = getServerEnv();
  if (env.NODE_ENV === "production") {
    if (env.PAYMENT_PROVIDER === "mock") throw new Error("PAYMENT_PROVIDER=mock is not allowed in production");
    if (env.WHATSAPP_PROVIDER === "mock") throw new Error("WHATSAPP_PROVIDER=mock is not allowed in production");
    if (env.OPENAI_PROVIDER === "mock") throw new Error("OPENAI_PROVIDER=mock is not allowed in production");
    if (!env.NEXTAUTH_SECRET || env.NEXTAUTH_SECRET.length < 32) throw new Error("NEXTAUTH_SECRET too short");
  }
  console.log("Environment validation passed.");
} catch (error) {
  // During local `next build` without production NODE_ENV, allow mock providers.
  if (process.env.NODE_ENV !== "production") {
    console.log("Environment validation skipped/relaxed for non-production build.");
    console.log(String(error));
    process.exit(0);
  }
  console.error(error);
  process.exit(1);
}
