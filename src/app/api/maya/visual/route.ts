import { readFileSync, existsSync } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { MAYA_COOKIE, ownerFromToken } from "@/lib/maya/owner";
import { masterMayaPath } from "@/lib/maya/visual";
import { withMayaRuntime } from "@/lib/maya/runtime";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(MAYA_COOKIE)?.value;
  const allowed = await withMayaRuntime(async ({ store }) => Boolean(await ownerFromToken(store, token)));
  if (!allowed) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const file = masterMayaPath();
  if (!existsSync(file)) return NextResponse.json({ error: "Master reference missing." }, { status: 404 });
  return new NextResponse(readFileSync(file), {
    headers: {
      "content-type": "image/png",
      "cache-control": "private, max-age=3600",
    },
  });
}
