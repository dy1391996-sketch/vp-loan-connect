import "./load-local-env";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const ORIGIN = new URL(BASE).origin;
const email = process.env.MAYA_OWNER_EMAIL ?? "";
const password = process.env.MAYA_OWNER_PASSWORD || (existsSync("/tmp/maya-owner-pass") ? readFileSync("/tmp/maya-owner-pass", "utf8") : "");

function cookieHeader(setCookie: string | null) {
  if (!setCookie) return "";
  return setCookie.split(";").at(0) ?? "";
}

async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`${ORIGIN}${path}`, {
    ...init,
    redirect: "manual",
    headers: {
      origin: ORIGIN,
      ...(init.headers ?? {}),
    },
  });
  const body = await response.text();
  return { status: response.status, location: response.headers.get("location"), setCookie: response.headers.get("set-cookie"), body };
}

async function main() {
  if (!email || password.length < 12) {
    throw new Error("Owner login password must be provided to this verifier via environment, not stored.");
  }

  const loginPage = await request("/maya/login");
  const loginOk = loginPage.status === 200 && /Owner access only/i.test(loginPage.body) && !/\$2[aby]\$/.test(loginPage.body);

  const unauthMaya = await request("/maya");
  const unauthMemoryPage = await request("/maya/memory");
  const unauthApi = await request("/api/maya/memory");
  const unauthChat = await request("/api/maya/chat");
  const protectedOk =
    (unauthMaya.status === 307 || unauthMaya.status === 302) &&
    (unauthMaya.location ?? "").includes("/maya/login") &&
    (unauthMemoryPage.status === 307 || unauthMemoryPage.status === 302) &&
    unauthApi.status === 401 &&
    unauthChat.status === 401;

  const invalid = await request("/api/maya/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "definitely-not-the-owner-password" }),
  });
  const invalidRejected = invalid.status === 401 && !cookieHeader(invalid.setCookie);

  const valid = await request("/api/maya/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const cookie = cookieHeader(valid.setCookie);
  let validBody: { authenticated?: boolean; ownerId?: string } = {};
  try {
    validBody = JSON.parse(valid.body) as { authenticated?: boolean; ownerId?: string };
  } catch {
    validBody = {};
  }
  const loginSucceeded = valid.status === 200 && validBody.authenticated === true && Boolean(validBody.ownerId) && cookie.startsWith("maya_owner=");

  const navChat = await request("/api/maya/chat", { headers: { cookie } });
  const navMemory = await request("/api/maya/memory", { headers: { cookie } });
  const navPage = await request("/maya", { headers: { cookie } });
  const sessionOk = navChat.status === 200 && navMemory.status === 200 && navPage.status === 200;

  const expectedOwnerId = process.env.MAYA_OWNER_ID ?? "";
  const ownerScoped = Boolean(validBody.ownerId) && (!expectedOwnerId || validBody.ownerId === expectedOwnerId);

  const logout = await request("/api/maya/logout", { method: "POST", headers: { cookie } });
  const afterLogout = await request("/api/maya/memory", { headers: { cookie } });
  const afterLogoutPage = await request("/maya", { headers: { cookie } });
  const logoutOk =
    logout.status === 200 &&
    afterLogout.status === 401 &&
    (afterLogoutPage.status === 307 || afterLogoutPage.status === 302 || afterLogoutPage.status === 401);

  const report = {
    loginPage: loginOk ? "PASS" : "FAIL",
    login: loginSucceeded ? "PASS" : "FAIL",
    invalidLoginRejected: invalidRejected ? "PASS" : "FAIL",
    protectedRoutes: protectedOk ? "PASS" : "FAIL",
    session: sessionOk ? "PASS" : "FAIL",
    logout: logoutOk ? "PASS" : "FAIL",
    ownerIdScoping: ownerScoped ? "PASS" : "FAIL",
  };
  writeFileSync("/tmp/maya-owner-auth-report.json", JSON.stringify(report, null, 2));
  console.info(JSON.stringify(report));
  if (Object.values(report).some((value) => value !== "PASS")) process.exit(1);
}

main().catch(() => {
  console.error("owner auth verify failed");
  process.exit(1);
});
