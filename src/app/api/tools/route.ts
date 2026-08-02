import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { writeAudit } from "@/lib/auth/session";
import { AI_TOOL_NAMES, executeAITool } from "@/lib/ai/tools";
import { jsonData, parseJsonBody, routeError } from "@/lib/api/route-helpers";

const schema = z.object({
  tool: z.enum(AI_TOOL_NAMES),
  args: z.unknown().default({}),
});

export async function POST(request: NextRequest) {
  const authResult = await requireApiUser(request, "bookings:manage");
  if ("error" in authResult) return authResult.error;
  try {
    const input = await parseJsonBody(request, schema);
    const result = await executeAITool(input.tool, input.args, authResult.auth.user.id);
    await writeAudit({
      actorId: authResult.auth.user.id,
      action: "ai.tool.execute",
      entityType: "AITool",
      entityId: input.tool,
      after: result,
    });
    return jsonData(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return routeError(error);
  }
}
