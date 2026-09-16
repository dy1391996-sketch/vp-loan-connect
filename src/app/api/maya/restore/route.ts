import { NextRequest, NextResponse } from "next/server";
import { MAYA_COOKIE, ownerFromToken } from "@/lib/maya/owner";
import { restoreBackup, restoreOwnerArchive } from "@/lib/maya/io";
import { withMayaRuntime } from "@/lib/maya/runtime";
import { assertSameOrigin } from "@/lib/security/request";

export async function POST(request: NextRequest) {
  assertSameOrigin(request);
  const token = request.cookies.get(MAYA_COOKIE)?.value;
  const body = (await request.json()) as { snapshot?: unknown; ownerId?: string; json?: unknown; mode?: "replace" | "merge" };
  const result = await withMayaRuntime(async ({ store }) => {
    const auth = await ownerFromToken(store, token);
    if (!auth) return null;
    if (body.snapshot) restoreBackup(store, { snapshot: body.snapshot as never });
    else if (body.json && body.ownerId === auth.owner.ownerId) {
      restoreOwnerArchive(store, { ownerId: body.ownerId, json: body.json as never }, body.mode ?? "replace");
    } else {
      throw new Error("INVALID_RESTORE");
    }
    return { restored: true };
  });
  if (!result) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  return NextResponse.json(result);
}
