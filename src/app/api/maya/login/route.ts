import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, rateLimit, requestIpHash } from "@/lib/security/request";
import { authenticateOwner, MAYA_COOKIE } from "@/lib/maya/owner";
import { withMayaRuntime } from "@/lib/maya/runtime";

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
  } catch {
    return NextResponse.json({ error: "Unable to sign in." }, { status: 500 });
  }
}
