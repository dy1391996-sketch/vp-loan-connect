import { NextRequest } from "next/server";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  if (existing.count >= limit) return { ok: false, remaining: 0, retryAfterMs: existing.resetAt - now };
  existing.count += 1;
  return { ok: true, remaining: limit - existing.count };
}

export function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!origin || !appUrl) return;
  try {
    if (new URL(origin).origin !== new URL(appUrl).origin) {
      throw new Error("Cross-origin request blocked.");
    }
  } catch {
    throw new Error("Cross-origin request blocked.");
  }
}
