import { NextRequest } from "next/server";
import { getPublicAppUrl, getServerEnv } from "@/lib/env";
import { sha256 } from "@/lib/utils";

type Bucket = { count: number; resetsAt: number };
const buckets = new Map<string, Bucket>();

function canonicalOrigin(value: string) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.hostname.replace(/^www\./i, "").toLowerCase()}`;
  } catch {
    return value;
  }
}

export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) {
    // Browser fetch/XHR always send Origin on cross-site and same-site POST in modern browsers.
    // Reject anonymous origin in production to reduce raw API script abuse.
    if (process.env.NODE_ENV === "production") throw new Error("INVALID_ORIGIN");
    return;
  }
  const expected = new URL(getPublicAppUrl()).origin;
  const requestOrigin = request.nextUrl.origin;
  if (origin === expected || origin === requestOrigin) return;
  // Accept www/apex variants of the public app host (common on Vercel).
  if (canonicalOrigin(origin) === canonicalOrigin(expected) || canonicalOrigin(origin) === canonicalOrigin(requestOrigin)) return;
  throw new Error("INVALID_ORIGIN");
}

export function requestIp(request: NextRequest) {
  return request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
}

export function requestIpHash(request: NextRequest) {
  const ip = requestIp(request);
  return ip ? sha256(`${ip}:${getServerEnv().NEXTAUTH_SECRET}`) : undefined;
}

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetsAt <= now) {
    buckets.set(key, { count: 1, resetsAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }
  if (current.count >= limit) return { allowed: false, remaining: 0, retryAfter: Math.ceil((current.resetsAt - now) / 1000) };
  current.count += 1;
  return { allowed: true, remaining: limit - current.count };
}

export function sanitizeText(value: string) {
  return value.replace(/[<>]/g, "").replace(/[\u0000-\u001F\u007F]/g, "").trim();
}
