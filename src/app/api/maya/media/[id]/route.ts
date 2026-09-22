import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { mediaOwner, mediaError } from "@/lib/maya/media/http";
import { defaultStore, reviewMedia } from "@/lib/maya/media/service";
import { qcSchema } from "@/lib/maya/media/types";
export const runtime = "nodejs";
const actionSchema = z.object({ action: z.enum(["accept", "reject", "archive", "reference", "qc-fail"]), qc: qcSchema.optional(), reason: z.string().trim().max(1000).optional() }).strict();
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) {
  try {
    const owner = await mediaOwner(request); const { id } = await context.params;
    const record = defaultStore.get(owner, id);
    const variant = request.nextUrl.searchParams.get("variant");
    const headers: Record<string, string> = { "cache-control": "private, no-store", "x-content-type-options": "nosniff" };
    if (variant === "details") return NextResponse.json(record, { headers });
    let file = record.file;
    if (variant === "thumbnail") file = record.thumbnail;
    if (variant?.startsWith("frame-")) file = record.frames?.[Number(variant.slice(6))];
    if (!file) throw new Error("MEDIA_HAS_NO_FILE");
    const bytes = file === record.file ? defaultStore.bytes(record) : readFileSync(defaultStore.path(owner, file));
    headers["content-type"] = file.endsWith("mp4") ? "video/mp4" : file.endsWith("png") ? "image/png" : "image/jpeg";
    if (request.nextUrl.searchParams.has("download")) headers["content-disposition"] = `attachment; filename="maya-${file}"`;
    // Range support permits seeking to middle/end during temporal review.
    const range = request.headers.get("range");
    headers["accept-ranges"] = "bytes";
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      const start = match ? Number(match[1]) : NaN; const end = match?.[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1;
      if (!Number.isSafeInteger(start) || start < 0 || start >= bytes.length || end < start) return new NextResponse(null, { status: 416, headers: { ...headers, "content-range": `bytes */${bytes.length}` } });
      return new NextResponse(new Uint8Array(bytes.subarray(start, end + 1)), { status: 206, headers: { ...headers, "content-range": `bytes ${start}-${end}/${bytes.length}`, "content-length": String(end - start + 1) } });
    }
    return new NextResponse(new Uint8Array(bytes), { headers: { ...headers, "content-length": String(bytes.length) } });
  } catch (e) { return mediaError(e); }
}
export async function PATCH(request: NextRequest, context: Context) {
  try {
    const owner = await mediaOwner(request, true); const { id } = await context.params;
    const body = await request.text(); if (body.length > 5000) throw new Error("REQUEST_TOO_LARGE");
    const data = actionSchema.parse(JSON.parse(body));
    return NextResponse.json({ record: reviewMedia(owner, id, data.action, data.qc, data.reason) });
  } catch (e) { return mediaError(e); }
}
