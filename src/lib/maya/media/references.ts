import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defaultStore, ingest, masterReference } from "./service";
import { digest } from "./store";
import { requestSchema, type MediaRecord } from "./types";
let pending: Promise<void> = Promise.resolve();
export function seedReferences(owner: string) {
  const task = pending.then(async () => {
    const manifest = join(process.cwd(), "config/maya/visual/references.json");
    if (!existsSync(manifest)) return;
    const master = masterReference();
    const refs = JSON.parse(readFileSync(manifest, "utf8")) as Array<{ id: string; file: string; sha256: string; title: string }>;
    for (const ref of refs) {
      if (defaultStore.list(owner).some(r => r.id === ref.id)) continue;
      if (!/^[\w.-]+$/.test(ref.file)) throw new Error("INVALID_REFERENCE_PATH");
      const bytes = readFileSync(join(process.cwd(), "data/maya/visual/references", ref.file));
      if (digest(bytes) !== ref.sha256) throw new Error("REFERENCE_INTEGRITY_FAILED");
      const at = new Date().toISOString();
      const record: MediaRecord = { id: ref.id, ownerId: owner, createdAt: at, updatedAt: at, status: "ACCEPTED", provenance: "USER_REFERENCE", request: requestSchema.parse({ kind: "photo", scene: ref.title }), masterHash: master.hash, referenceHashes: [], prompt: "User supplied identity reference; not a generated image and does not replace Master.", promptVersion: "1.0.0", provider: "user-supplied", model: "original", useAsReference: true, history: [{ at, status: "ACCEPTED", note: "User explicitly supplied for visual identity/reference." }] };
      defaultStore.save(await ingest(record, bytes, ref.file.endsWith("png") ? "image/png" : "image/jpeg"));
    }
  });
  pending = task.catch(() => undefined); return task;
}
