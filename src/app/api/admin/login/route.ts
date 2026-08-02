import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertSameOrigin, rateLimit, requestIpHash } from "@/lib/security/request";
import { signAccessToken } from "@/lib/security/tokens";
import { sha256 } from "@/lib/utils";

const schema = z.object({ email: z.string().email().transform((v) => v.trim().toLowerCase()), password: z.string().min(12).max(200) });

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const ipHash = requestIpHash(request) ?? "unknown";
    if (!rateLimit(`admin-login:${ipHash}`, 8, 15 * 60 * 1000).allowed) return NextResponse.json({ error: "Too many login attempts. Try again later." }, { status: 429 });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    const admin = await prisma.adminUser.findUnique({ where: { email: parsed.data.email } });
    if (!admin || !admin.active || !(await bcrypt.compare(parsed.data.password, admin.passwordHash))) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const draftSession = await prisma.adminSession.create({ data: { adminId: admin.id, tokenHash: `pending-${crypto.randomUUID()}`, expiresAt } });
    const token = await signAccessToken("admin_session", admin.id, { sessionId: draftSession.id, role: admin.role }, "8h");
    await prisma.$transaction([
      prisma.adminSession.update({ where: { id: draftSession.id }, data: { tokenHash: sha256(token) } }),
      prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } }),
      prisma.auditLog.create({ data: { adminId: admin.id, action: "ADMIN_LOGIN", entityType: "AdminUser", entityId: admin.id, ipHash, userAgent: request.headers.get("user-agent")?.slice(0, 500) } }),
    ]);
    const response = NextResponse.json({ authenticated: true });
    response.cookies.set("vplc_admin", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt });
    return response;
  } catch (error) {
    console.error("admin_login_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Unable to sign in." }, { status: 500 });
  }
}
