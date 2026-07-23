import { validateBuildEnvironment } from "../src/lib/env";

if (process.env.VERCEL_ENV === "production" || process.env.VALIDATE_PRODUCTION_ENV === "true") {
  validateBuildEnvironment(process.env);
}
