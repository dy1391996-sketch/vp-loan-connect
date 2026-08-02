import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { assertCan, type Permission } from "@/lib/auth/permissions";
import { clientIp, rateLimit } from "@/lib/security/request";

export async function requireApiUser(request: NextRequest, permission?: Permission) {
  const ip = clientIp(request);
  const limited = rateLimit(`api:${ip}`, 120, 60_000);
  if (!limited.ok) {
    return { error: NextResponse.json({ error: "Too many requests." }, { status: 429 }) };
  }
  const auth = await getSession();
  if (!auth) {
    return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  }
  if (permission) {
    try {
      assertCan(auth.user.role, permission);
    } catch {
      return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
    }
  }
  return { auth };
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
