import { validateProductionEnvironment } from "../src/lib/env";

if (process.env.VERCEL_ENV === "production" || process.env.VALIDATE_PRODUCTION_ENV === "true") {
  validateProductionEnvironment(process.env);
}
