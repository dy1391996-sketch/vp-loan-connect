import { NextRequest, NextResponse } from "next/server";
import { MAYA_COOKIE, ownerFromToken } from "@/lib/maya/owner";
import { getMayaEnv } from "@/lib/maya/env";
import { retrieveRelevantContext } from "@/lib/maya/retrieval";
import { withMayaRuntime } from "@/lib/maya/runtime";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production" || !getMayaEnv().MAYA_DEBUG) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const token = request.cookies.get(MAYA_COOKIE)?.value;
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const result = await withMayaRuntime(async ({ store }) => {
    const auth = await ownerFromToken(store, token);
    if (!auth) return null;
    const retrieved = retrieveRelevantContext(store, { ownerId: auth.owner.ownerId, utterance: q });
    return {
      provider: getMayaEnv().MAYA_LLM_PROVIDER,
      retrieved: retrieved.ranked.map((row) => ({ memoryId: row.memory.memoryId, score: row.score, reasons: row.reasons, content: row.memory.content })),
      people: retrieved.people.map((person) => person.personId),
      projects: retrieved.projects.map((project) => project.projectId),
      openLoops: retrieved.loops.map((loop) => loop.openLoopId),
    };
  });
  if (!result) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  return NextResponse.json(result);
}
