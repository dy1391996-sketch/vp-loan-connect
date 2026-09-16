import { NextRequest } from "next/server";
import { getPublicAppUrl, getServerEnv } from "@/lib/env";
import { sha256 } from "@/lib/utils";

type Bucket = { count: number; resetsAt: number };
const buckets = new Map<string, Bucket>();

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function canonicalHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "").replace(/^www\./i, "").toLowerCase();
  return LOOPBACK_HOSTS.has(host) ? "localhost" : host;
}

function canonicalOrigin(value: string) {
  try {
    const url = new URL(value);
    const port = url.port || (url.protocol === "https:" ? "443" : url.protocol === "http:" ? "80" : "");
    return `${url.protocol}//${canonicalHost(url.hostname)}${port ? `:${port}` : ""}`;
  } catch {
    return value;
  }
}

function originFromHostHeader(request: NextRequest, origin: string) {
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host");
  if (!host) return "";
  try {
    return `${new URL(origin).protocol}//${host}`;
  } catch {
    return "";
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
  const hostOrigin = originFromHostHeader(request, origin);
  const originCanon = canonicalOrigin(origin);
  if ([expected, requestOrigin, hostOrigin].some((value) => value && (value === origin || canonicalOrigin(value) === originCanon))) return;
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

/** Test-only helper — clears in-memory rate-limit buckets. */
export function resetRateLimitsForTests() {
  buckets.clear();
}

export function sanitizeText(value: string) {
  return value.replace(/[<>]/g, "").replace(/[\u0000-\u001F\u007F]/g, "").trim();
}
