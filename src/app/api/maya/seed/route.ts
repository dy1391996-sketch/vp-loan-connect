import { NextRequest, NextResponse } from "next/server";
import { MAYA_COOKIE, ownerFromToken } from "@/lib/maya/owner";
import { importSeed } from "@/lib/maya/io";
import { withMayaRuntime } from "@/lib/maya/runtime";
import { assertSameOrigin } from "@/lib/security/request";
import type { MayaSeedDocument } from "@/lib/maya/types";

export async function POST(request: NextRequest) {
  assertSameOrigin(request);
  const token = request.cookies.get(MAYA_COOKIE)?.value;
  const body = (await request.json()) as MayaSeedDocument;
  if (body.source !== "SYSTEM_SEED") return NextResponse.json({ error: "Seed source must be SYSTEM_SEED." }, { status: 400 });
  const result = await withMayaRuntime(async ({ store }) => {
    const auth = await ownerFromToken(store, token);
    if (!auth) return null;
    return importSeed(store, auth.owner.ownerId, body);
  });
  if (!result) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  return NextResponse.json(result);
}
