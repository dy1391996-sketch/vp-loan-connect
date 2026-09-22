import { NextRequest, NextResponse } from "next/server";
import { mediaOwner, mediaError } from "@/lib/maya/media/http";
import { createMedia, defaultStore, masterReference, recoverInterrupted } from "@/lib/maya/media/service";
import { providerStatus } from "@/lib/maya/media/provider";
import { seedReferences } from "@/lib/maya/media/references";
import { rateLimit } from "@/lib/security/request";
export const runtime = "nodejs";
export const maxDuration = 240;
export async function GET(request: NextRequest) {
  try {
    const owner = await mediaOwner(request);
    await seedReferences(owner);
    recoverInterrupted(owner);
    let master: { available: boolean; hash?: string; error?: string };
    try { master = { available: true, hash: masterReference().hash }; } catch (e) { master = { available: false, error: e instanceof Error ? e.message : "MASTER_MISSING" }; }
    return NextResponse.json({ records: defaultStore.list(owner), provider: await providerStatus(), master }, { headers: { "cache-control": "private, no-store" } });
  } catch (e) { return mediaError(e); }
}
export async function POST(request: NextRequest) {
  try {
    const owner = await mediaOwner(request, true);
    if (!rateLimit(`maya-media:${owner}`, 6, 60000).allowed) return NextResponse.json({ error: "Please wait before generating again." }, { status: 429 });
    if (Number(request.headers.get("content-length")) > 16000) throw new Error("REQUEST_TOO_LARGE");
    const body = await request.text(); if (body.length > 16000) throw new Error("REQUEST_TOO_LARGE");
    const record = await createMedia(owner, JSON.parse(body));
    return NextResponse.json({ record }, { status: record.status === "FAILED" ? 503 : 201 });
  } catch (e) { return mediaError(e); }
}
