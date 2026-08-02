import { z } from "zod";
import type { NextRequest } from "next/server";
import { Prisma, PricingRuleType, StudioCategory } from "@prisma/client";
import { requireApiUser } from "@/lib/auth/api";
import { writeAudit } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { jsonData, parseJsonBody, routeError, type RouteContext } from "@/lib/api/route-helpers";

const updatePricingSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.nativeEnum(PricingRuleType).optional(),
  active: z.boolean().optional(),
  priority: z.number().int().optional(),
  minHours: z.number().int().positive().nullable().optional(),
  maxHours: z.number().int().positive().nullable().optional(),
  dayType: z.string().optional(),
  specialDate: z.string().datetime().nullable().optional(),
  specialDateEnd: z.string().datetime().nullable().optional(),
  amountInr: z.number().int().nonnegative().optional(),
  isPercent: z.boolean().optional(),
  percentValue: z.number().nullable().optional(),
  couponCode: z.string().nullable().optional(),
  studioId: z.string().nullable().optional(),
  category: z.nativeEnum(StudioCategory).nullable().optional(),
  minOccupancy: z.number().nullable().optional(),
  maxOccupancy: z.number().nullable().optional(),
  returningOnly: z.boolean().optional(),
  requiresOwnerApproval: z.boolean().optional(),
  approved: z.boolean().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authResult = await requireApiUser(request, "pricing:manage");
  if ("error" in authResult) return authResult.error;
  const { id } = await context.params;
  try {
    const input = await parseJsonBody(request, updatePricingSchema);
    const before = await prisma.pricingRule.findUniqueOrThrow({ where: { id } });
    const rule = await prisma.pricingRule.update({
      where: { id },
      data: {
        ...input,
        specialDate: input.specialDate ? new Date(input.specialDate) : input.specialDate,
        specialDateEnd: input.specialDateEnd ? new Date(input.specialDateEnd) : input.specialDateEnd,
        metadata: input.metadata === null ? Prisma.JsonNull : (input.metadata as Prisma.InputJsonValue | undefined),
      },
    });
    await writeAudit({ actorId: authResult.auth.user.id, action: "pricing.update", entityType: "PricingRule", entityId: id, before, after: rule });
    return jsonData(rule);
  } catch (error) {
    return routeError(error);
  }
}
