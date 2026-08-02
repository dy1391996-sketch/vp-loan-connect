import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { COOKIE_NAME } from "@/lib/constants";
import { sha256, randomToken } from "@/lib/utils";
import { signAccessToken } from "@/lib/security/tokens";
import { clientIp, rateLimit } from "@/lib/security/request";
import { jsonError, jsonOk } from "@/lib/auth/api";
import { writeAudit } from "@/lib/auth/session";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const limited = rateLimit(`login:${ip}`, 10, 60_000);
  if (!limited.ok) return jsonError("Too many login attempts. Try again shortly.", 429);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid email or password.");

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user || !user.active) return jsonError("Invalid email or password.", 401);

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) return jsonError("Invalid email or password.", 401);

  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: sha256(`pending:${randomToken(16)}`),
      expiresAt,
      ipHash: sha256(ip),
      userAgent: request.headers.get("user-agent")?.slice(0, 300),
    },
  });

  const jwt = await signAccessToken("admin_session", user.id, { sessionId: session.id }, "8h");
  await prisma.session.update({ where: { id: session.id }, data: { tokenHash: sha256(jwt) } });

  await writeAudit({
    actorId: user.id,
    action: "auth.login",
    entityType: "User",
    entityId: user.id,
    ipHash: sha256(ip),
  });

  const response = jsonOk({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  response.cookies.set(COOKIE_NAME, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return response;
}
