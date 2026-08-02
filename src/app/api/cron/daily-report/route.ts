import { NextResponse, type NextRequest } from "next/server";
import { executeAITool } from "@/lib/ai/tools";
import { getServerEnv } from "@/lib/env";
import { bearerToken, routeError } from "@/lib/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    if (bearerToken(request) !== getServerEnv().CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const result = await executeAITool("generateDailyReport", {});
    return NextResponse.json({ ok: result.success, result }, { status: result.success ? 200 : 500 });
  } catch (error) {
    return routeError(error);
  }
}
