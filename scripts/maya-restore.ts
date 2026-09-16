import "./load-local-env";
import { readFileSync } from "node:fs";
import { restoreBackup } from "../src/lib/maya/io";
import { InMemoryMayaStore } from "../src/lib/maya/store";
import { saveMayaSnapshotToPrisma } from "../src/lib/maya/prisma-persist";
import { prisma } from "../src/lib/db";

const file = process.argv[2];
if (!file) {
  console.error("Usage: pnpm maya:restore -- path/to/maya-backup.json");
  process.exit(1);
}
const backup = JSON.parse(readFileSync(file, "utf8")) as { snapshot: never };
const store = new InMemoryMayaStore();
restoreBackup(store, backup);
await saveMayaSnapshotToPrisma(prisma, store.snapshot());
console.info("restored", file);
