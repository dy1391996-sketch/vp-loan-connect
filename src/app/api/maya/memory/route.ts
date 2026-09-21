import { NextRequest, NextResponse } from "next/server";
import { MAYA_COOKIE, ownerFromToken } from "@/lib/maya/owner";
import { withMayaRuntime } from "@/lib/maya/runtime";
import { correctMemory, forgetMemory } from "@/lib/maya/correction";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(MAYA_COOKIE)?.value;
  const q = request.nextUrl.searchParams.get("q") ?? undefined;
  const type = request.nextUrl.searchParams.get("type") ?? undefined;
  const result = await withMayaRuntime(async ({ store }) => {
    const auth = await ownerFromToken(store, token);
    if (!auth) return null;
    return store.listMemories({
      ownerId: auth.owner.ownerId,
      text: q,
      types: type ? [type as never] : undefined,
      status: ["active", "uncertain", "superseded", "corrected"],
      includeDeleted: false,
      limit: 100,
    });
  });
  if (!result) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  return NextResponse.json({ memories: result });
}

export async function PATCH(request: NextRequest) {
  const token = request.cookies.get(MAYA_COOKIE)?.value;
  const body = (await request.json()) as { memoryId?: string; content?: string };
  if (!body.memoryId || !body.content) return NextResponse.json({ error: "memoryId and content required." }, { status: 400 });
  const result = await withMayaRuntime(async ({ store }) => {
    const auth = await ownerFromToken(store, token);
    if (!auth) return null;
    return correctMemory(store, auth.owner.ownerId, body.memoryId!, body.content!);
  });
  if (!result) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  return NextResponse.json({ corrected: true, old: result.old, next: result.next });
}

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get(MAYA_COOKIE)?.value;
  const memoryId = request.nextUrl.searchParams.get("memoryId");
  if (!memoryId) return NextResponse.json({ error: "memoryId required." }, { status: 400 });
  const result = await withMayaRuntime(async ({ store }) => {
    const auth = await ownerFromToken(store, token);
    if (!auth) return null;
    return forgetMemory(store, auth.owner.ownerId, memoryId);
  });
  if (!result) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  return NextResponse.json({ deleted: true, memory: result });
}
