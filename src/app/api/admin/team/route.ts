import bcrypt from "bcryptjs";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { StaffRole } from "@prisma/client";
import { requireApiUser } from "@/lib/auth/api";
import { writeAudit } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { jsonData, parseJsonBody, routeError } from "@/lib/api/route-helpers";

const teamCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(12),
  role: z.nativeEnum(StaffRole).default("READ_ONLY"),
  phone: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const authResult = await requireApiUser(request, "team:manage");
  if ("error" in authResult) return authResult.error;
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, phone: true, active: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: "desc" },
  });
  return jsonData(users);
}

export async function POST(request: NextRequest) {
  const authResult = await requireApiUser(request, "team:manage");
  if ("error" in authResult) return authResult.error;
  try {
    const input = await parseJsonBody(request, teamCreateSchema);
    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        name: input.name,
        phone: input.phone,
        role: input.role,
        passwordHash: await bcrypt.hash(input.password, 12),
        createdById: authResult.auth.user.id,
      },
      select: { id: true, email: true, name: true, role: true, phone: true, active: true, createdAt: true },
    });
    await writeAudit({ actorId: authResult.auth.user.id, action: "team.create", entityType: "User", entityId: user.id, after: user });
    return jsonData(user, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
