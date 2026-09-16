import { readFileSync } from "node:fs";
import { importSeed } from "../src/lib/maya/io";
import { InMemoryMayaStore } from "../src/lib/maya/store";
import { loadMayaSnapshotFromPrisma, saveMayaSnapshotToPrisma } from "../src/lib/maya/prisma-persist";
import { prisma } from "../src/lib/db";
import { ensureSeededOwner } from "../src/lib/maya/owner";
import type { MayaSeedDocument } from "../src/lib/maya/types";

const file = process.argv[2] ?? "data/maya-seed-template.json";
const seed = JSON.parse(readFileSync(file, "utf8")) as MayaSeedDocument;
if (seed.source !== "SYSTEM_SEED") throw new Error("Seed source must be SYSTEM_SEED");
const store = new InMemoryMayaStore(await loadMayaSnapshotFromPrisma(prisma));
const owner = await ensureSeededOwner(store);
if (!owner) throw new Error("Set MAYA_OWNER_EMAIL and MAYA_OWNER_PASSWORD before importing seed.");
const result = importSeed(store, owner.ownerId, seed);
await saveMayaSnapshotToPrisma(prisma, store.snapshot());
console.info("imported", file, result);
