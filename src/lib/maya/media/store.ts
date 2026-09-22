import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, openSync, closeSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { MediaRecord } from "./types";
export const digest = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
export class MediaStore {
  constructor(readonly root = join(process.cwd(), "data/maya/media")) {}
  ownerDir(ownerId: string) { return join(this.root, digest(ownerId)); }
  path(ownerId: string, file: string) {
    if (!/^[a-zA-Z0-9._-]+$/.test(file) || file.startsWith(".")) throw new Error("INVALID_MEDIA_PATH");
    return join(this.ownerDir(ownerId), file);
  }
  list(ownerId: string): MediaRecord[] {
    const file = this.path(ownerId, "metadata.json");
    if (!existsSync(file)) return [];
    return JSON.parse(readFileSync(file, "utf8")) as MediaRecord[];
  }
  get(ownerId: string, id: string) {
    const record = this.list(ownerId).find(r => r.id === id && r.ownerId === ownerId);
    if (!record) throw new Error("MEDIA_NOT_FOUND");
    return record;
  }
  save(record: MediaRecord, expected?: string) {
    mkdirSync(this.ownerDir(record.ownerId), { recursive: true, mode: 0o700 });
    const lock = this.path(record.ownerId, "write.lock");
    // All work inside the lock is synchronous and bounded. A crashed process leaves an explicit recoverable lock.
    let fd: number;
    try { fd = openSync(lock, "wx", 0o600); } catch { throw new Error("MEDIA_STORE_BUSY"); }
    try {
      const all = this.list(record.ownerId);
      const current = all.find(r => r.id === record.id);
      if (expected && current?.updatedAt !== expected) throw new Error("MEDIA_CHANGED_RELOAD");
      const next = [...all.filter(r => r.id !== record.id), record].sort((a,b) => b.createdAt.localeCompare(a.createdAt));
      const temp = this.path(record.ownerId, `${randomUUID()}.tmp`);
      writeFileSync(temp, JSON.stringify(next, null, 2), { mode: 0o600 });
      renameSync(temp, this.path(record.ownerId, "metadata.json"));
      return record;
    } finally { closeSync(fd); unlinkSync(lock); }
  }
  bytes(record: MediaRecord) {
    if (!record.file) throw new Error("MEDIA_HAS_NO_FILE");
    const data = readFileSync(this.path(record.ownerId, record.file));
    if (digest(data) !== record.sha256) throw new Error("MEDIA_INTEGRITY_FAILED");
    return data;
  }
}
