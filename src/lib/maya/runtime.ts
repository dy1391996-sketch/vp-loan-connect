import { prisma } from "@/lib/db";
import { MayaBrain } from "./brain";
import { getMayaEnv } from "./env";
import { createMayaProvider } from "./providers";
import { loadMayaSnapshotFromPrisma, saveMayaSnapshotToPrisma } from "./prisma-persist";
import { InMemoryMayaStore } from "./store";
import { ensureSeededOwner } from "./owner";
import { redactSecrets } from "./secrets";

const globalForMaya = globalThis as unknown as {
  mayaMemoryStore?: InMemoryMayaStore;
  mayaPrismaStore?: InMemoryMayaStore;
  mayaPersistChain?: Promise<unknown>;
};

function memoryStore() {
  globalForMaya.mayaMemoryStore ??= new InMemoryMayaStore();
  return globalForMaya.mayaMemoryStore;
}

function usesMemoryStore() {
  const env = getMayaEnv();
  return env.MAYA_STORE === "memory";
}

async function prismaBackedStore() {
  if (globalForMaya.mayaPrismaStore) return globalForMaya.mayaPrismaStore;
  const store = new InMemoryMayaStore(await loadMayaSnapshotFromPrisma(prisma));
  globalForMaya.mayaPrismaStore = store;
  return store;
}

async function runWithMayaRuntime<T>(fn: (input: { store: InMemoryMayaStore; brain: MayaBrain }) => Promise<T>, debug = false) {
  const env = getMayaEnv();
  const useMemory = usesMemoryStore();
  const store = useMemory ? memoryStore() : await prismaBackedStore();
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

export async function withMayaRuntime<T>(fn: (input: { store: InMemoryMayaStore; brain: MayaBrain }) => Promise<T>, debug = false) {
  if (usesMemoryStore()) return runWithMayaRuntime(fn, debug);
  const previous = globalForMaya.mayaPersistChain ?? Promise.resolve();
  let release: (value?: unknown) => void = () => undefined;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  globalForMaya.mayaPersistChain = previous.then(() => gate, () => gate);
  try {
    return await runWithMayaRuntime(fn, debug);
  } finally {
    release();
  }
}

export function mayaEvent(event: string, meta?: Record<string, string | number | boolean | undefined>) {
  const safe = redactSecrets(Object.fromEntries(Object.entries(meta ?? {}).filter(([, value]) => value !== undefined)));
  console.info("maya_event", event, safe);
}
