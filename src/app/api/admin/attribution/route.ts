import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { getChannelAttributionMetrics } from "@/lib/domain/attribution-metrics";
import { jsonData, routeError } from "@/lib/api/route-helpers";

export async function GET(request: NextRequest) {
  const authResult = await requireApiUser(request, "analytics:view");
  if ("error" in authResult) return authResult.error;
  try {
    return jsonData(await getChannelAttributionMetrics());
  } catch (error) {
    return routeError(error);
  }
}
