import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env";
import { bearerToken, routeError } from "@/lib/api/route-helpers";
import { processDueFollowUps } from "@/lib/domain/followups";

export async function GET(request: NextRequest) {
  try {
    if (bearerToken(request) !== getServerEnv().CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const result = await processDueFollowUps();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return routeError(error);
  }
}
