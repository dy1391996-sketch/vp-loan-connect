/**
 * Reports Phase 2/3 provider readiness without printing secret values.
 */
import { getServerEnv, resetEnvCache } from "../src/lib/env";
import { instagramProviderAvailability } from "../src/lib/integrations/instagram/client";

resetEnvCache();

try {
  const env = getServerEnv();
  const ig = instagramProviderAvailability();
  const report = {
    whatsappProvider: env.WHATSAPP_PROVIDER,
    instagramProvider: env.INSTAGRAM_PROVIDER,
    paymentProvider: env.PAYMENT_PROVIDER,
    openaiProvider: env.OPENAI_PROVIDER,
    instagramLiveReady: ig.available && ig.mode === "meta",
    missingInstagram: ig.missing,
    hasWhatsAppToken: Boolean(env.WHATSAPP_ACCESS_TOKEN),
    hasWhatsAppPhoneId: Boolean(env.WHATSAPP_PHONE_NUMBER_ID),
    hasMetaAppSecret: Boolean(env.WHATSAPP_APP_SECRET || process.env.META_APP_SECRET),
    hasVerifyToken: Boolean(env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN),
    supportWhatsAppConfigured: Boolean(env.SUPPORT_WHATSAPP),
  };
  console.log(JSON.stringify(report, null, 2));
  console.log("Environment check complete (no secret values printed).");
} catch (error) {
  console.error(String(error));
  process.exit(1);
}
