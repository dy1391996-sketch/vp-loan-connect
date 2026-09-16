import "./load-local-env";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";
import { getMayaEnv, resetMayaEnvCacheForTests } from "../src/lib/maya/env";

resetMayaEnvCacheForTests();

function upsertEnvLocal(updates: Record<string, string | null>) {
  const path = resolve(process.cwd(), ".env.local");
  const current = existsSync(path) ? readFileSync(path, "utf8") : "";
  const lines = current.split("\n");
  const seen = new Set<string>();
  const next: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      next.push(line);
      continue;
    }
    const key = trimmed.slice(0, trimmed.indexOf("=")).trim();
    if (!(key in updates)) {
      next.push(line);
      continue;
    }
    seen.add(key);
    const value = updates[key];
    if (value === null) continue;
    next.push(`${key}="${value.replaceAll('"', '\\"')}"`);
  }
  for (const [key, value] of Object.entries(updates)) {
    if (seen.has(key) || value === null) continue;
    next.push(`${key}="${value.replaceAll('"', '\\"')}"`);
  }
  writeFileSync(path, `${next.filter((line, index, all) => !(line === "" && all[index - 1] === "")).join("\n").trim()}\n`);
}

async function main() {
  const env = getMayaEnv();
  if (!env.MAYA_OWNER_EMAIL) {
    console.info(JSON.stringify({
      ownerEmailConfigured: false,
      passwordHashConfigured: false,
      plaintextPasswordStored: false,
      userInputRequired: "MAYA_OWNER_EMAIL",
    }));
    process.exit(2);
  }

  const plaintext = env.MAYA_OWNER_PASSWORD;
  let hash = env.MAYA_OWNER_PASSWORD_HASH.startsWith("$2") ? env.MAYA_OWNER_PASSWORD_HASH : "";
  if (!hash) {
    if (plaintext.length < 12) {
      console.info(JSON.stringify({
        ownerEmailConfigured: true,
        passwordHashConfigured: false,
        plaintextPasswordStored: false,
        userInputRequired: "MAYA_OWNER_PASSWORD_HASH",
      }));
      process.exit(2);
    }
    hash = await bcrypt.hash(plaintext, 12);
  }

  const existing = await prisma.mayaOwner.findUnique({ where: { email: env.MAYA_OWNER_EMAIL.toLowerCase() } });
  const ownerId = env.MAYA_OWNER_ID || existing?.id;
  if (existing) {
    await prisma.mayaOwner.update({
      where: { id: existing.id },
      data: { passwordHash: hash, active: true },
    });
  }

  upsertEnvLocal({
    MAYA_OWNER_EMAIL: env.MAYA_OWNER_EMAIL.toLowerCase(),
    MAYA_OWNER_PASSWORD_HASH: hash,
    MAYA_OWNER_PASSWORD: null,
    MAYA_OWNER_ID: ownerId ?? null,
    MAYA_STORE: "prisma",
    MAYA_LLM_PROVIDER: "mock",
  });

  if (plaintext.length >= 12) {
    writeFileSync("/tmp/maya-owner-pass", plaintext, { mode: 0o600 });
  }

  console.info(JSON.stringify({
    ownerEmailConfigured: true,
    passwordHashConfigured: true,
    plaintextPasswordStored: false,
    ownerIdPinned: Boolean(ownerId),
    existingOwner: Boolean(existing),
    secretsWrittenTo: ".env.local",
    secretsCommitted: false,
  }));
  await prisma.$disconnect();
}

main().catch(() => {
  console.error("owner activation failed");
  process.exit(1);
});
