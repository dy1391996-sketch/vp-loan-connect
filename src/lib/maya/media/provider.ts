import { z } from "zod";
import type { MediaProvider, ProviderInput, ProviderOutput } from "./types";
const capabilitySchema = z.object({ protocol: z.literal("maya-media-v1"), cost: z.literal("free-local"), referenceConditioning: z.literal(true), photo: z.boolean(), imageToVideo: z.boolean(), model: z.string().min(1).max(120) });
function endpoint() {
  const configured = process.env.MAYA_MEDIA_LOCAL_URL;
  if (!configured) throw new Error("NO_FREE_MEDIA_PROVIDER: No reference-conditioned local image/video service is configured.");
  const url = new URL(configured);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.username || url.password || url.search || url.hash) throw new Error("LOCAL_PROVIDER_ONLY");
  return url;
}
export async function providerStatus() {
  try {
    const url = endpoint();
    const response = await fetch(new URL("/capabilities", url), { signal: AbortSignal.timeout(3000), redirect: "error", cache: "no-store" });
    if (!response.ok) throw new Error("LOCAL_PROVIDER_UNAVAILABLE");
    const capabilities = capabilitySchema.parse(await response.json());
    return { available: true as const, ...capabilities };
  } catch (error) {
    return { available: false as const, photo: false, imageToVideo: false, reason: error instanceof Error && /NO_FREE_MEDIA_PROVIDER|LOCAL_PROVIDER_ONLY/.test(error.message) ? error.message : "LOCAL_PROVIDER_UNAVAILABLE: No compatible free local service responded." };
  }
}
async function generate(input: ProviderInput): Promise<ProviderOutput> {
  const status = await providerStatus();
  if (!status.available) throw new Error(status.reason);
  if (input.request.kind === "photo" ? !status.photo : !status.imageToVideo) throw new Error("PROVIDER_MODE_UNAVAILABLE");
  if (input.request.kind === "video" && !input.source) throw new Error("APPROVED_SOURCE_PHOTO_REQUIRED");
  const form = new FormData();
  form.set("request", JSON.stringify({ ...input.request, prompt: input.prompt, protocol: "maya-media-v1" }));
  form.set("master", new Blob([new Uint8Array(input.master)]), "master.png");
  input.references.forEach((ref, i) => form.append("references", new Blob([new Uint8Array(ref)]), `reference-${i}.png`));
  if (input.source) form.set("source", new Blob([new Uint8Array(input.source)]), "approved-source.png");
  const response = await fetch(new URL("/generate", endpoint()), { method: "POST", body: form, signal: AbortSignal.timeout(2400000), redirect: "error" });
  if (!response.ok || !response.body) throw new Error("LOCAL_GENERATION_FAILED");
  const mime = response.headers.get("content-type")?.split(";")[0];
  if (mime !== "image/png" && mime !== "image/jpeg" && mime !== "video/mp4") throw new Error("INVALID_PROVIDER_MEDIA");
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  while (true) { const { value, done } = await reader.read(); if (done) break; total += value.byteLength; if (total > 40 * 1024 * 1024) { await reader.cancel(); throw new Error("MEDIA_TOO_LARGE"); } chunks.push(value); }
  return { bytes: Buffer.concat(chunks), mime, model: status.model };
}
export const localMediaProvider: MediaProvider = { id: "free-local-bridge", generatePhoto: generate, generateVideo: generate, imageToVideo: generate };
