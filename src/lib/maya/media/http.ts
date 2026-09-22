import { NextRequest, NextResponse } from "next/server";
import { ownerFromToken, MAYA_COOKIE } from "../owner";
import { withMayaRuntime } from "../runtime";
import { assertSameOrigin } from "@/lib/security/request";
export async function mediaOwner(request: NextRequest, mutation = false) {
  if (mutation) {
    // Same-origin CSRF gate; loopback aliases (localhost ↔ 127.0.0.1) are accepted by assertSameOrigin.
    assertSameOrigin(request);
  }
  const auth = await withMayaRuntime(async ({ store }) => ownerFromToken(store, request.cookies.get(MAYA_COOKIE)?.value));
  if (!auth) throw new Error("AUTH_REQUIRED");
  return auth.owner.ownerId;
}
export function mediaError(error: unknown) {
  const raw = error instanceof Error ? error.message : "MEDIA_ERROR";
  const message = /^[A-Z_]+(?::[^\n]{0,180})?$/.test(raw) ? raw : "INVALID_MEDIA_REQUEST";
  return NextResponse.json({ error: message }, { status: message === "AUTH_REQUIRED" ? 401 : message === "INVALID_ORIGIN" ? 403 : message === "MEDIA_NOT_FOUND" ? 404 : 400, headers: { "cache-control": "private, no-store" } });
}
