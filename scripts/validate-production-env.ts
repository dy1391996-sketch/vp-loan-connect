import { validateBuildEnvironment, validateCriticalProductionEnvironment } from "../src/lib/env";

// Vercel production: require live payment + OTP (MSG91). Preview/dev keep soft build checks.
if (process.env.VERCEL_ENV === "production" || process.env.VALIDATE_PRODUCTION_ENV === "true") {
  validateCriticalProductionEnvironment(process.env);
} else if (process.env.NODE_ENV === "production") {
  validateBuildEnvironment(process.env);
}
