import "./load-local-env";
import { consolidateOwnerMemory } from "../src/lib/maya/consolidation";
import { InMemoryMayaStore } from "../src/lib/maya/store";
import { loadMayaSnapshotFromPrisma, saveMayaSnapshotToPrisma } from "../src/lib/maya/prisma-persist";
import { prisma } from "../src/lib/db";

async function main() {
  const store = new InMemoryMayaStore(await loadMayaSnapshotFromPrisma(prisma));
  for (const owner of store.listOwners()) {
    const result = consolidateOwnerMemory(store, owner.ownerId);
    console.info(owner.ownerId, result.summary);
  }
  await saveMayaSnapshotToPrisma(prisma, store.snapshot());
}

main().catch(() => {
  console.error("consolidate failed");
  process.exit(1);
});
