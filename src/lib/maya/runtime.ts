import { prisma } from "@/lib/db";
import { MayaBrain } from "./brain";
import { getMayaEnv } from "./env";
import { createMayaProvider } from "./providers";
import { loadMayaSnapshotFromPrisma, saveMayaSnapshotToPrisma } from "./prisma-persist";
import { InMemoryMayaStore } from "./store";
import { ensureSeededOwner } from "./owner";

const globalForMaya = globalThis as unknown as { mayaMemoryStore?: InMemoryMayaStore };

function memoryStore() {
  globalForMaya.mayaMemoryStore ??= new InMemoryMayaStore();
  return globalForMaya.mayaMemoryStore;
}

export async function withMayaRuntime<T>(fn: (input: { store: InMemoryMayaStore; brain: MayaBrain }) => Promise<T>, debug = false) {
  const env = getMayaEnv();
  const useMemory = env.MAYA_STORE === "memory" || process.env.NODE_ENV === "test";
  const store = useMemory ? memoryStore() : new InMemoryMayaStore(await loadMayaSnapshotFromPrisma(prisma));
  await ensureSeededOwner(store);
  const brain = new MayaBrain({
    store,
    provider: createMayaProvider(env.MAYA_LLM_PROVIDER),
    debug: debug || (env.MAYA_DEBUG && process.env.NODE_ENV !== "production"),
  });
  const result = await fn({ store, brain });
  if (!useMemory) await saveMayaSnapshotToPrisma(prisma, store.snapshot());
  return result;
}

export function mayaEvent(event: string, meta?: Record<string, string | number | boolean | undefined>) {
  const safe = Object.fromEntries(Object.entries(meta ?? {}).filter(([, value]) => value !== undefined));
  console.info("maya_event", event, safe);
}
