import "./load-local-env";
import { writeFileSync } from "node:fs";

const PHASE = process.argv[2] ?? "store";
const MARKER = "HttpLotus4421";
const BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const ORIGIN = new URL(BASE).origin;
const email = process.env.MAYA_OWNER_EMAIL ?? "";
const password = process.env.MAYA_OWNER_PASSWORD ?? "";

if (!email || password.length < 12) {
  throw new Error("Owner authentication is not configured.");
}

function cookieHeader(setCookie: string | null) {
  if (!setCookie) throw new Error("Login did not set a session cookie.");
  return setCookie.split(";").at(0) ?? "";
}

async function login() {
  const response = await fetch(`${ORIGIN}/api/maya/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Login failed (${response.status}).`);
  if (!body.authenticated) throw new Error("Login did not authenticate.");
  return { cookie: cookieHeader(response.headers.get("set-cookie")), ownerId: body.ownerId as string };
}

async function chat(cookie: string, text: string) {
  const response = await fetch(`${ORIGIN}/api/maya/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, cookie },
    body: JSON.stringify({ text }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Chat failed (${response.status}).`);
  return body as { text: string; conversationId: string };
}

if (PHASE === "store") {
  const auth = await login();
  const reply = await chat(auth.cookie, `The project named ${MARKER} is my restart-persistence project.`);
  writeFileSync("/tmp/maya-http-persistence.json", JSON.stringify({ marker: MARKER, stored: true, replyPreview: reply.text.slice(0, 160) }));
  console.info(JSON.stringify({ phase: "store", stored: true, replyPreview: reply.text.slice(0, 160) }));
} else if (PHASE === "recall") {
  const auth = await login();
  const reply = await chat(auth.cookie, `${MARKER} project kaisa chal raha hai?`);
  const recalled = /HttpLotus4421|restart-persistence/i.test(reply.text);
  const natural = !/मुझे याद है|मेरी memory|database/i.test(reply.text);
  writeFileSync("/tmp/maya-http-recall.json", JSON.stringify({ phase: "recall", recalled, natural, replyPreview: reply.text.slice(0, 160) }));
  console.info(JSON.stringify({ phase: "recall", recalled, natural, replyPreview: reply.text.slice(0, 160) }));
  if (!recalled || !natural) process.exit(1);
} else {
  throw new Error(`Unknown phase ${PHASE}`);
}
