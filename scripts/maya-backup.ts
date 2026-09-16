import "./load-local-env";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { backupStore } from "../src/lib/maya/io";
import { InMemoryMayaStore } from "../src/lib/maya/store";
import { loadMayaSnapshotFromPrisma } from "../src/lib/maya/prisma-persist";
import { prisma } from "../src/lib/db";

async function main() {
  const store = new InMemoryMayaStore(await loadMayaSnapshotFromPrisma(prisma));
  const backup = backupStore(store, { includeOwnerSecrets: true });
  const dir = join(process.cwd(), "data/maya/backups");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `maya-backup-${backup.createdAt.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(backup, null, 2));
  console.info("wrote", file, {
    owners: backup.snapshot.owners.length,
    memories: backup.snapshot.memories.length,
    people: backup.snapshot.people.length,
    projects: backup.snapshot.projects.length,
    timeline: backup.snapshot.timeline.length,
    openLoops: backup.snapshot.openLoops.length,
  });
}

main().catch(() => {
  console.error("backup failed");
  process.exit(1);
});
