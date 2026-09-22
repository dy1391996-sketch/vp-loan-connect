import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { MediaStore, digest } from "./store";
import { localMediaProvider } from "./provider";
import { requestSchema, type MediaProvider, type MediaRecord, type MediaRequest, type MediaStatus, type QC } from "./types";
export const defaultStore = new MediaStore();
export function masterReference(project = process.cwd()) {
  const file = join(project, "config/maya/visual/MASTER_MAYA_REFERENCE.png");
  if (!existsSync(file)) throw new Error("MASTER_MAYA_MISSING");
  const bytes = readFileSync(file); const hash = digest(bytes);
  const pin = join(project, "config/maya/visual/master-integrity.json");
  if (!existsSync(pin) || JSON.parse(readFileSync(pin, "utf8")).sha256 !== hash) throw new Error("MASTER_INTEGRITY_REVIEW_REQUIRED");
  return { bytes, hash };
}
export function compilePrompt(request: MediaRequest, recent: MediaRecord[]) {
  const approved = recent.filter(r => r.status === "ACCEPTED").slice(0, 8);
  const rejected = recent.filter(r => r.rejectionReason).slice(0, 8);
  return [
    "1 IDENTITY: Use the attached immutable Master Maya image as highest identity authority. Same adult fictional Maya; preserve face geometry, eyes, nose, lips, jaw, skin tone, age impression and natural body proportions. Identity lock is not pose lock.",
    "2 REFERENCES: Master > user-approved references > accepted generations > visual specification > scene. Transfer identity, not Master pose. " + (request.sourcePhotoId ? `Exact approved source photo ${request.sourcePhotoId}: preserve starting face, body, outfit, room, light and pose; add motion only.` : "Create a genuinely new moment."),
    `3 SCENE (${request.mode}): ${request.scene}`,
    `4 OUTFIT: ${request.outfit || "appropriate ordinary clothing for the scene"}`,
    `5 POSE / ACTION: ${request.pose || "natural pose distinct from recent accepted images"}; ${request.activity}`,
    `6 EXPRESSION: ${request.expression || "relaxed natural expression"}`,
    `7 CAMERA: ${request.camera}; framing: ${request.framing}`,
    `8 LIGHT: ${request.lighting}; hair arrangement: ${request.hairstyle}`,
    "9 REALISM: natural skin texture, subtle asymmetry, realistic hair strands, hands, fabric, shadows and reflections. Ordinary believable environment.",
    "10 PREVENT: identity/age drift, plastic skin, beauty filters, duplicate limbs, extra fingers, warped objects, random text, watermarks, jewelry mutation. Do not repeat cheek-on-hand, head tilt, crop or background unless explicitly requested.",
    `Continuity source: ${request.continuityId || "none"}. Recent accepted moments (avoid unnecessary repetition, user scene wins): ${JSON.stringify(approved.map(r => ({ id: r.id, outfit: r.request.outfit, scene: r.request.scene, pose: r.request.pose, expression: r.request.expression, camera: r.request.camera, framing: r.request.framing })))}`,
    `Prior rejection feedback (do not redefine identity): ${JSON.stringify(rejected.map(r => r.rejectionReason))}`,
    request.kind === "video" ? `MOTION: ${request.motion}. Stable identity at start, middle and end. No morphing, flickering, clothing mutation or background melting.` : "",
    "11 PROVIDER: maya-media-v1; actual reference images are attached separately. Synthetic creative visual; not evidence of a real event.",
  ].filter(Boolean).join("\n\n");
}
function transition(record: MediaRecord, status: MediaStatus, note?: string) {
  const at = new Date().toISOString();
  return { ...record, status, updatedAt: at, history: [...record.history, { at, status, note }] };
}
export function resolveRequest(owner: string, input: unknown, store = defaultStore) {
  const request = requestSchema.parse(input);
  if (request.continuity.length && !request.continuityId) throw new Error("CONTINUITY_SOURCE_REQUIRED");
  if (request.continuityId) {
    const source = store.get(owner, request.continuityId);
    if (source.status !== "ACCEPTED") throw new Error("CONTINUITY_REQUIRES_ACCEPTED_MEDIA");
    for (const key of request.continuity) request[key] = source.request[key];
  }
  if (request.kind === "video") {
    if (!request.sourcePhotoId) throw new Error("APPROVED_SOURCE_PHOTO_REQUIRED");
    const source = store.get(owner, request.sourcePhotoId);
    if (source.status !== "ACCEPTED" || source.request.kind !== "photo" || !source.file) throw new Error("APPROVED_SOURCE_PHOTO_REQUIRED");
    for (const key of ["scene", "outfit", "pose", "lighting", "hairstyle", "framing"] as const) request[key] = source.request[key];
  }
  for (const id of request.referenceIds) {
    const ref = store.get(owner, id);
    if (ref.status !== "ACCEPTED" || !ref.useAsReference || ref.request.kind !== "photo") throw new Error("REFERENCE_NOT_APPROVED");
  }
  return request;
}
export async function ingest(record: MediaRecord, bytes: Buffer, mime: string, store = defaultStore) {
  if (!bytes.length || bytes.length > 40 * 1024 * 1024) throw new Error("MEDIA_SIZE_INVALID");
  mkdirSync(store.ownerDir(record.ownerId), { recursive: true, mode: 0o700 });
  const ext = record.request.kind === "photo" ? (mime === "image/jpeg" ? "jpg" : "png") : "mp4";
  if (record.request.kind === "video" ? mime !== "video/mp4" : !["image/png", "image/jpeg"].includes(mime)) throw new Error("MEDIA_TYPE_MISMATCH");
  const file = `${record.id}.${ext}`;
  if (record.request.kind === "photo") {
    const meta = await sharp(bytes, { limitInputPixels: 20000000 }).metadata();
    if (!meta.width || !meta.height || meta.width < 256 || meta.height < 256 || !["png", "jpeg"].includes(meta.format || "")) throw new Error("IMAGE_QC_FAILED");
    const thumb = await sharp(bytes).resize(480, 640, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    record.thumbnail = `${record.id}-thumb.jpg`;
    writeFileSync(store.path(record.ownerId, record.thumbnail), thumb, { flag: "wx", mode: 0o600 });
  }
  writeFileSync(store.path(record.ownerId, file), bytes, { flag: "wx", mode: 0o600 });
  if (record.request.kind === "video") {
    const path = store.path(record.ownerId, file);
    // No shell interpolation, no external protocols/playlists. Local MP4 only.
    const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-protocol_whitelist", "file", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", path], { timeout: 15000, maxBuffer: 1024 * 1024 }).toString());
    const duration = Number(probe.format?.duration);
    if (!Number.isFinite(duration) || duration < 1 || duration > 30 || !probe.streams?.some((s: { codec_type: string; width: number; height: number }) => s.codec_type === "video" && s.width >= 256 && s.height >= 256 && s.width <= 4096 && s.height <= 4096)) throw new Error("VIDEO_QC_FAILED");
    record.frames = [];
    for (const [index, time] of [0, duration / 2, Math.max(0, duration - 0.15)].entries()) {
      const name = `${record.id}-frame-${index}.jpg`;
      execFileSync("ffmpeg", ["-v", "error", "-protocol_whitelist", "file", "-ss", String(time), "-i", path, "-frames:v", "1", "-vf", "scale=480:-2", "-n", store.path(record.ownerId, name)], { timeout: 20000, maxBuffer: 1024 * 1024 });
      if (!existsSync(store.path(record.ownerId, name))) throw new Error("VIDEO_FRAME_QC_FAILED");
      record.frames.push(name);
    }
    record.thumbnail = record.frames[0];
  }
  return { ...record, file, sha256: digest(bytes) };
}
export async function createMedia(owner: string, input: unknown, options: { store?: MediaStore; provider?: MediaProvider; project?: string } = {}) {
  const store = options.store ?? defaultStore; const provider = options.provider ?? localMediaProvider;
  const request = resolveRequest(owner, input, store);
  const master = masterReference(options.project);
  const references = request.referenceIds.map(id => store.bytes(store.get(owner, id)));
  const source = request.sourcePhotoId ? store.bytes(store.get(owner, request.sourcePhotoId)) : undefined;
  if (store.list(owner).some(r => r.status === "GENERATING" && Date.now() - Date.parse(r.updatedAt) < 240000)) throw new Error("GENERATION_ALREADY_RUNNING");
  const now = new Date().toISOString();
  let record: MediaRecord = { id: randomUUID(), ownerId: owner, createdAt: now, updatedAt: now, status: "GENERATING", provenance: "VISUAL_GENERATION", request, masterHash: master.hash, referenceHashes: references.map(digest), prompt: compilePrompt(request, store.list(owner)), promptVersion: "1.0.0", provider: provider.id, model: "pending", useAsReference: false, history: [{ at: now, status: "GENERATING" }] };
  store.save(record);
  try {
    const input = { request, prompt: record.prompt, master: master.bytes, references, source };
    const output = request.kind === "photo" ? await provider.generatePhoto(input) : await provider.imageToVideo({ ...input, source: source! });
    record.model = output.model;
    record = store.save(transition(record, "GENERATED", "Provider returned bytes; visual identity is not yet verified."));
    try { record = await ingest(record, output.bytes, output.mime, store); }
    catch { return store.save(transition({ ...record, error: "MEDIA_TECHNICAL_QC_FAILED" }, "QC_FAILED", "Decode/size/frame checks failed; cannot accept.")); }
    // Never infer identity from an HTTP response or automated file checks.
    return store.save(transition(record, "READY_FOR_REVIEW", "Technical checks passed. Owner must inspect identity/anatomy/scene; video start, middle and end."));
  } catch (error) {
    const message = error instanceof Error && /^(NO_FREE_MEDIA_PROVIDER|LOCAL_PROVIDER|PROVIDER_MODE|MEDIA_TOO_LARGE|INVALID_PROVIDER)/.test(error.message) ? error.message : "GENERATION_FAILED: Provider did not produce usable media.";
    return store.save(transition({ ...record, error: message }, "FAILED", message));
  }
}
export function reviewMedia(owner: string, id: string, action: "accept" | "reject" | "archive" | "reference" | "qc-fail", qc?: QC, reason?: string, store = defaultStore) {
  const record = store.get(owner, id); const previous = record.updatedAt;
  if (record.status === "GENERATING") throw new Error("GENERATION_IN_PROGRESS");
  if (action === "reference") {
    if (record.status !== "ACCEPTED" || record.request.kind !== "photo") throw new Error("ONLY_ACCEPTED_PHOTO_REFERENCE");
    store.bytes(record);
    return store.save({ ...record, useAsReference: true, updatedAt: new Date().toISOString() }, previous);
  }
  if (action === "accept") {
    if (record.status !== "READY_FOR_REVIEW" || !record.file || !qc?.identity || !qc.anatomy || !qc.scene || !qc.quality || (record.request.kind === "video" && (!qc.start || !qc.middle || !qc.end))) throw new Error("VISUAL_QC_REQUIRED");
    store.bytes(record);
    return store.save(transition({ ...record, qc }, "ACCEPTED", "Explicit owner acceptance; Master unchanged."), previous);
  }
  if (action === "qc-fail" && record.status !== "READY_FOR_REVIEW") throw new Error("REVIEW_NOT_AVAILABLE");
  if ((action === "reject" || action === "qc-fail") && !reason?.trim()) throw new Error("REJECTION_REASON_REQUIRED");
  return store.save(transition({ ...record, useAsReference: false, rejectionReason: action === "archive" ? record.rejectionReason : reason }, action === "archive" ? "ARCHIVED" : action === "reject" ? "REJECTED" : "QC_FAILED", reason), previous);
}
export function recoverInterrupted(owner: string, store = defaultStore) {
  for (const record of store.list(owner)) if (["GENERATING", "GENERATED"].includes(record.status) && Date.now() - Date.parse(record.updatedAt) > 300000) store.save(transition({ ...record, error: "GENERATION_INTERRUPTED: Retry as a new request." }, "FAILED"), record.updatedAt);
}
