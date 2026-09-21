import { NextRequest, NextResponse } from "next/server";
import { MAYA_COOKIE, ownerFromToken } from "@/lib/maya/owner";
import { backupStore } from "@/lib/maya/io";
import { withMayaRuntime } from "@/lib/maya/runtime";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(MAYA_COOKIE)?.value;
  const result = await withMayaRuntime(async ({ store }) => {
    const auth = await ownerFromToken(store, token);
    if (!auth) return null;
    return backupStore(store);
  });
  if (!result) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  return NextResponse.json(result);
}
