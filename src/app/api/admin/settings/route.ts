import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { writeAudit } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { jsonData, parseJsonBody, routeError } from "@/lib/api/route-helpers";

const settingSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
});

export async function GET(request: NextRequest) {
  const authResult = await requireApiUser(request, "settings:manage");
  if ("error" in authResult) return authResult.error;
  const settings = await prisma.businessSetting.findMany({ orderBy: { key: "asc" } });
  return jsonData(settings);
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireApiUser(request, "settings:manage");
  if ("error" in authResult) return authResult.error;
  try {
    const input = await parseJsonBody(request, settingSchema);
    const before = await prisma.businessSetting.findUnique({ where: { key: input.key } });
    const setting = await prisma.businessSetting.upsert({
      where: { key: input.key },
      create: { key: input.key, value: input.value as object, createdById: authResult.auth.user.id },
      update: { value: input.value as object, createdById: authResult.auth.user.id },
    });
    await writeAudit({ actorId: authResult.auth.user.id, action: "settings.upsert", entityType: "BusinessSetting", entityId: setting.id, before, after: setting });
    return jsonData(setting);
  } catch (error) {
    return routeError(error);
  }
}
