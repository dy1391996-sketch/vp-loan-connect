import bcrypt from "bcryptjs";
import { getMayaEnv } from "./env";
import { newId, nowIso, type MayaStore } from "./store";
import { sha256 } from "@/lib/server-crypto";
import { signAccessToken, verifyAccessToken } from "@/lib/security/tokens";
import { ensureMasterVisualAsset } from "./visual";
import { defaultRelationshipState } from "./state";

export const MAYA_COOKIE = "maya_owner";

export function ownerAuthConfigured(env = getMayaEnv()) {
  if (!env.MAYA_OWNER_EMAIL) return false;
  if (env.MAYA_OWNER_PASSWORD_HASH.startsWith("$2")) return true;
  return env.MAYA_OWNER_PASSWORD.length >= 12;
}

function configuredOwnerHash(env = getMayaEnv()) {
  return env.MAYA_OWNER_PASSWORD_HASH.startsWith("$2") ? env.MAYA_OWNER_PASSWORD_HASH : "";
}

function revokeOwnerSessions(store: MayaStore, ownerId: string) {
  const at = nowIso();
  for (const session of store.snapshot().sessions) {
    if (session.ownerId === ownerId && !session.revokedAt) store.revokeSession(session.sessionId, at);
  }
}

async function createOwnerFromEnv(store: MayaStore) {
  const env = getMayaEnv();
  if (!ownerAuthConfigured(env)) return undefined;
  const passwordHash = configuredOwnerHash(env) || (env.MAYA_OWNER_PASSWORD.length >= 12 ? await bcrypt.hash(env.MAYA_OWNER_PASSWORD, 12) : "");
  if (!passwordHash) return undefined;
  const existing = store.getOwnerByEmail(env.MAYA_OWNER_EMAIL);
  if (existing) {
    const hashChanged = existing.passwordHash !== passwordHash;
    if (hashChanged || !existing.active) {
      store.upsertOwner({
        ...existing,
        passwordHash,
        active: true,
        updatedAt: nowIso(),
      });
      if (hashChanged) revokeOwnerSessions(store, existing.ownerId);
    }
    if (!store.getRelationshipState(existing.ownerId)) {
      store.saveRelationshipState(defaultRelationshipState(existing.ownerId, nowIso()));
    }
    ensureMasterVisualAsset(store, existing.ownerId);
    return store.getOwner(existing.ownerId);
  }
  const claimed = env.MAYA_OWNER_ID ? store.getOwner(env.MAYA_OWNER_ID) : undefined;
  const ownerId = claimed ? newId() : env.MAYA_OWNER_ID || newId();
  const owner = store.upsertOwner({
    ownerId,
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

export async function authenticateLocalOwner(store: MayaStore) {
  if (process.env.NODE_ENV === "production") return null;
  if (process.env.MAYA_LOCAL_PASSWORDLESS !== "true") return null;

  const owner = await ensureSeededOwner(store);
  if (!owner || !owner.active) return null;

  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  const sessionId = newId();

  const token = await signAccessToken(
    "maya_owner_session",
    owner.ownerId,
    { sessionId },
    "12h",
  );

  store.createSession({
    sessionId,
    ownerId: owner.ownerId,
    tokenHash: sha256(token),
    expiresAt: expiresAt.toISOString(),
    createdAt: nowIso(),
  });

  return { owner, token, expiresAt };
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
