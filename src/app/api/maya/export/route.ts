import { NextRequest, NextResponse } from "next/server";
import { MAYA_COOKIE, ownerFromToken } from "@/lib/maya/owner";
import { exportOwnerArchive } from "@/lib/maya/io";
import { withMayaRuntime } from "@/lib/maya/runtime";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(MAYA_COOKIE)?.value;
  const format = request.nextUrl.searchParams.get("format") ?? "json";
  const result = await withMayaRuntime(async ({ store }) => {
    const auth = await ownerFromToken(store, token);
    if (!auth) return null;
    return exportOwnerArchive(store, auth.owner.ownerId);
  });
  if (!result) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (format === "markdown") {
    return new NextResponse(result.markdown, {
      headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": "attachment; filename=maya-memory.md" },
    });
  }
  return NextResponse.json({ exportedAt: result.exportedAt, ownerId: result.ownerId, json: result.json, markdown: result.markdown });
}
