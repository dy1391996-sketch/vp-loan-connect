import { createHash, randomBytes } from "node:crypto";

/** Server-only SHA-256. Keep this out of client bundles (do not import from UI code). */
export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

export function generateReferralCode(seed?: string) {
  const suffix = sha256(seed ?? randomToken(8)).slice(0, 7).toUpperCase();
  return `VPLC${suffix}`;
}
