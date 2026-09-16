import { NextRequest, NextResponse } from "next/server";
import { MAYA_COOKIE, ownerFromToken } from "@/lib/maya/owner";
import { withMayaRuntime } from "@/lib/maya/runtime";
import { assertSameOrigin } from "@/lib/security/request";
import { nowIso } from "@/lib/maya/store";

export async function POST(request: NextRequest) {
  assertSameOrigin(request);
  const token = request.cookies.get(MAYA_COOKIE)?.value;
  await withMayaRuntime(async ({ store }) => {
    const auth = await ownerFromToken(store, token);
    if (auth) store.revokeSession(auth.session.sessionId, nowIso());
  });
  const response = NextResponse.json({ signedOut: true });
  response.cookies.delete(MAYA_COOKIE);
  return response;
}
