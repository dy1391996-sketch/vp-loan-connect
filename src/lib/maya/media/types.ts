import { z } from "zod";
export const requestSchema = z.object({
  kind: z.enum(["photo", "video"]),
  mode: z.enum(["casual", "lifestyle", "fashion", "fitness", "social", "custom"]).default("casual"),
  scene: z.string().trim().min(3).max(2000),
  outfit: z.string().max(300).default(""), pose: z.string().max(300).default(""),
  expression: z.string().max(200).default(""), camera: z.string().max(200).default("smartphone candid"),
  framing: z.string().max(200).default("waist-up"), lighting: z.string().max(200).default("natural available light"),
  hairstyle: z.string().max(200).default("natural long dark hair"), activity: z.string().max(300).default(""),
  motion: z.string().max(400).default("subtle breathing, blinking and natural hair movement; no face morphing"),
  sourcePhotoId: z.string().uuid().optional(), continuityId: z.string().uuid().optional(),
  continuity: z.array(z.enum(["outfit", "scene", "lighting", "hairstyle"])).max(4).default([]),
  referenceIds: z.array(z.string().uuid()).max(3).default([]),
}).strict();
export type MediaRequest = z.infer<typeof requestSchema>;
export type MediaStatus = "GENERATING" | "GENERATED" | "QC_FAILED" | "READY_FOR_REVIEW" | "ACCEPTED" | "REJECTED" | "ARCHIVED" | "FAILED";
export type QC = { identity: boolean; anatomy: boolean; scene: boolean; quality: boolean; start: boolean; middle: boolean; end: boolean; note: string };
export const qcSchema = z.object({ identity: z.boolean(), anatomy: z.boolean(), scene: z.boolean(), quality: z.boolean(), start: z.boolean().default(false), middle: z.boolean().default(false), end: z.boolean().default(false), note: z.string().max(1000).default("") }).strict();
export interface MediaRecord {
  id: string; ownerId: string; createdAt: string; updatedAt: string; status: MediaStatus;
  provenance: "VISUAL_GENERATION" | "USER_REFERENCE"; request: MediaRequest;
  masterHash: string; referenceHashes: string[]; prompt: string; promptVersion: string;
  provider: string; model: string; file?: string; thumbnail?: string; frames?: string[];
  sha256?: string; error?: string; qc?: QC; rejectionReason?: string; useAsReference: boolean;
  history: Array<{ at: string; status: MediaStatus; note?: string }>;
}
export interface ProviderInput { request: MediaRequest; prompt: string; master: Buffer; references: Buffer[]; source?: Buffer; }
export interface ProviderOutput { bytes: Buffer; mime: "image/png" | "image/jpeg" | "video/mp4"; model: string; }
export interface PhotoProvider { id: string; generatePhoto(input: ProviderInput): Promise<ProviderOutput>; }
export interface VideoProvider { id: string; generateVideo(input: ProviderInput): Promise<ProviderOutput>; }
export interface ImageToVideoProvider { id: string; imageToVideo(input: ProviderInput & { source: Buffer }): Promise<ProviderOutput>; }
export interface LipSyncProvider { id: string; lipSync(video: Buffer, audio: Buffer): Promise<ProviderOutput>; }
export interface UpscaleProvider { id: string; upscale(image: Buffer): Promise<ProviderOutput>; }
export interface MediaProvider extends PhotoProvider, VideoProvider, ImageToVideoProvider {}
