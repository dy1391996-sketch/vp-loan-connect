import bcrypt from "bcryptjs";
import { getMayaEnv } from "./env";
import { newId, nowIso, type MayaStore } from "./store";
import { sha256 } from "@/lib/utils";
import { signAccessToken, verifyAccessToken } from "@/lib/security/tokens";
import { ensureMasterVisualAsset } from "./visual";
import { defaultRelationshipState } from "./state";

export const MAYA_COOKIE = "maya_owner";

export function ownerAuthConfigured(env = getMayaEnv()) {
  if (!env.MAYA_OWNER_EMAIL) return false;
  if (env.MAYA_OWNER_PASSWORD_HASH.startsWith("$2")) return true;
  return env.MAYA_OWNER_PASSWORD.length >= 12;
}

async function createOwnerFromEnv(store: MayaStore) {
  const env = getMayaEnv();
  if (!ownerAuthConfigured(env)) return undefined;
  const existing = store.getOwnerByEmail(env.MAYA_OWNER_EMAIL);
  if (existing) return existing;
  const passwordHash = env.MAYA_OWNER_PASSWORD_HASH.startsWith("$2")
    ? env.MAYA_OWNER_PASSWORD_HASH
    : await bcrypt.hash(env.MAYA_OWNER_PASSWORD, 12);
  const owner = store.upsertOwner({
    ownerId: env.MAYA_OWNER_ID || newId(),
    email: env.MAYA_OWNER_EMAIL.toLowerCase(),
    passwordHash,
    instagramAccountIds: env.MAYA_INSTAGRAM_OWNER_IDS.split(/[\s,]+/).filter(Boolean),
    active: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  store.saveRelationshipState(defaultRelationshipState(owner.ownerId, nowIso()));
  ensureMasterVisualAsset(store, owner.ownerId);
  return owner;
}

export async function ensureSeededOwner(store: MayaStore) {
  return (await createOwnerFromEnv(store)) ?? store.listOwners()[0];
}

export async function authenticateOwner(store: MayaStore, email: string, password: string) {
  await ensureSeededOwner(store);
  const owner = store.getOwnerByEmail(email.trim().toLowerCase());
  if (!owner || !owner.active) return null;
  if (!(await bcrypt.compare(password, owner.passwordHash))) return null;
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  const sessionId = newId();
  const token = await signAccessToken("maya_owner_session", owner.ownerId, { sessionId }, "12h");
  store.createSession({
    sessionId,
    ownerId: owner.ownerId,
    tokenHash: sha256(token),
    expiresAt: expiresAt.toISOString(),
    createdAt: nowIso(),
  });
  return { owner, token, expiresAt };
}

export async function ownerFromToken(store: MayaStore, token: string | undefined) {
  if (!token) return null;
  try {
    const payload = await verifyAccessToken(token, "maya_owner_session");
    if (typeof payload.sessionId !== "string" || !payload.sub) return null;
    const session = store.getSessionByTokenHash(sha256(token));
    if (!session || session.sessionId !== payload.sessionId || session.revokedAt || Date.parse(session.expiresAt) < Date.now()) return null;
    const owner = store.getOwner(session.ownerId);
    if (!owner?.active) return null;
    return { owner, session };
  } catch {
    return null;
  }
}
