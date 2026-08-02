import { NextResponse, type NextRequest } from "next/server";
import { expireDueHolds } from "@/lib/domain/holds";
import { getServerEnv } from "@/lib/env";
import { bearerToken, routeError } from "@/lib/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    if (bearerToken(request) !== getServerEnv().CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const expired = await expireDueHolds();
    return NextResponse.json({ ok: true, expired });
  } catch (error) {
    return routeError(error);
  }
}
