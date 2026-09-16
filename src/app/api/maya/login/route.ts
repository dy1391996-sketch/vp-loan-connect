import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, rateLimit, requestIpHash } from "@/lib/security/request";
import { authenticateOwner, MAYA_COOKIE, ownerAuthConfigured } from "@/lib/maya/owner";
import { withMayaRuntime } from "@/lib/maya/runtime";
import { redactSecrets } from "@/lib/maya/secrets";

const schema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(12).max(200),
});

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const ipHash = requestIpHash(request) ?? "unknown";
    if (!rateLimit(`maya-login:${ipHash}`, 8, 15 * 60 * 1000).allowed) {
      return NextResponse.json({ error: "Too many login attempts." }, { status: 429 });
    }
    if (!ownerAuthConfigured()) {
      return NextResponse.json({ error: "Owner authentication is not configured." }, { status: 503 });
    }
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    const auth = await withMayaRuntime(async ({ store }) => authenticateOwner(store, parsed.data.email, parsed.data.password));
    if (!auth) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    const response = NextResponse.json({ authenticated: true, ownerId: auth.owner.ownerId });
    response.cookies.set(MAYA_COOKIE, auth.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: auth.expiresAt,
    });
    return response;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    if (err.message === "INVALID_ORIGIN") {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
    const failing = (err.stack ?? "").split("\n").map((line) => line.trim()).find((line) => line.startsWith("at ")) ?? "";
    const message = err.message
      .replace(/postgres(?:ql)?:\/\/\S+/gi, "postgresql://***")
      .replace(/\$2[aby]?\$\d{2}\$[./A-Za-z0-9]+/g, "[bcrypt]");
    console.error("maya_login_failed", redactSecrets({ name: err.name, message, failing }));
    return NextResponse.json({ error: "Unable to sign in." }, { status: 500 });
  }
}
