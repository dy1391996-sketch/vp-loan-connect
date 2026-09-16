import { existsSync } from "node:fs";
import { join } from "node:path";
import type { MayaStore } from "./store";
import { newId, nowIso } from "./store";

export const MASTER_ASSET_ID = "00000000-0000-4000-a000-000000000001";
export const MASTER_MAYA_RELATIVE_PATH = "config/maya/visual/MASTER_MAYA_REFERENCE.png";
export const APPROVED_VISUAL_DIR = "data/maya/visual/approved";
export const REJECTED_VISUAL_DIR = "data/maya/visual/rejected";

export function masterMayaPath() {
  return join(process.cwd(), MASTER_MAYA_RELATIVE_PATH);
}

export function ensureMasterVisualAsset(store: MayaStore, ownerId: string) {
  const existing = store.listVisualAssets(ownerId).find((asset) => asset.kind === "master");
  if (existing) return existing;
  return store.upsertVisualAsset({
    assetId: MASTER_ASSET_ID,
    ownerId,
    kind: "master",
    path: MASTER_MAYA_RELATIVE_PATH,
    note: existsSync(masterMayaPath())
      ? "Immutable Master Maya identity. Never overwrite automatically."
      : "Master path reserved. File was not present in this environment.",
    immutable: true,
    createdAt: nowIso(),
  });
}

export function registerVisualGeneration(store: MayaStore, ownerId: string, kind: "approved" | "rejected", relativePath: string, note?: string) {
  if (kind === "approved" && relativePath === MASTER_MAYA_RELATIVE_PATH) {
    throw new Error("MASTER_MAYA_IMMUTABLE");
  }
  return store.upsertVisualAsset({
    assetId: newId(),
    ownerId,
    kind,
    path: relativePath,
    note,
    immutable: false,
    createdAt: nowIso(),
  });
}
