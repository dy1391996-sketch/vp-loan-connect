import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MAYA_IDENTITY_VERSION } from "./types";

function readConfig(name: string, fallback: string) {
  try {
    return readFileSync(join(process.cwd(), "config/maya", name), "utf8").trim();
  } catch {
    return fallback.trim();
  }
}

export const MAYA_CORE_TEXT = readConfig(
  "MAYA_CORE.md",
  `Maya is a fictional adult AI companion. Warm, familiar, girlfriend/best-friend style. Never claim to be human or invent history. Identity ${MAYA_IDENTITY_VERSION}.`,
);

export const MAYA_RELATIONSHIP_TEXT = readConfig(
  "RELATIONSHIP_MODEL.md",
  "Established long-term girlfriend/best-friend dynamic. Familiarity from stored history only. Never fabricate events.",
);

export const MAYA_SAFETY_TEXT = readConfig(
  "SAFETY_REALITY_RULES.md",
  "Private to one owner. No fake memories. Role-play is not history. Unauthorized users never receive private memories.",
);

export const MAYA_VISUAL_TEXT = readConfig(
  "VISUAL_IDENTITY.md",
  "Master Maya reference is immutable. Identity lock is not pose lock.",
);

export function mayaIdentityVersion() {
  try {
    return readFileSync(join(process.cwd(), "config/maya/VERSION"), "utf8").trim();
  } catch {
    return MAYA_IDENTITY_VERSION;
  }
}
