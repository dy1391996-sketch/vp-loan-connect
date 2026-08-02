import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { executeAITool } from "@/lib/ai/tools";

function authorize(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const env = getServerEnv();
  return auth === `Bearer ${env.CRON_SECRET}`;
}

export async function GET(request: NextRequest) {
  if (!authorize(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await executeAITool("generateWeeklyReport", {});
  return NextResponse.json(result);
}
