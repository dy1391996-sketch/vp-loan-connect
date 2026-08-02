import { z } from "zod";
import type { NextRequest } from "next/server";
import { Prisma, PricingRuleType, StudioCategory } from "@prisma/client";
import { requireApiUser } from "@/lib/auth/api";
import { writeAudit } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { jsonData, parseJsonBody, routeError } from "@/lib/api/route-helpers";

const pricingSchema = z.object({
  name: z.string().min(1),
  type: z.nativeEnum(PricingRuleType),
  active: z.boolean().default(true),
  priority: z.number().int().default(100),
  minHours: z.number().int().positive().optional(),
  maxHours: z.number().int().positive().optional(),
  dayType: z.string().default("ANY"),
  specialDate: z.string().datetime().optional(),
  specialDateEnd: z.string().datetime().optional(),
  amountInr: z.number().int().nonnegative(),
  isPercent: z.boolean().default(false),
  percentValue: z.number().optional(),
  couponCode: z.string().optional(),
  studioId: z.string().optional(),
  category: z.nativeEnum(StudioCategory).optional(),
  minOccupancy: z.number().optional(),
  maxOccupancy: z.number().optional(),
  returningOnly: z.boolean().default(false),
  requiresOwnerApproval: z.boolean().default(false),
  approved: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});

export async function GET(request: NextRequest) {
  const authResult = await requireApiUser(request, "pricing:manage");
  if ("error" in authResult) return authResult.error;
  const rules = await prisma.pricingRule.findMany({ orderBy: [{ active: "desc" }, { priority: "asc" }, { createdAt: "desc" }] });
  return jsonData(rules);
}

export async function POST(request: NextRequest) {
  const authResult = await requireApiUser(request, "pricing:manage");
  if ("error" in authResult) return authResult.error;
  try {
    const input = await parseJsonBody(request, pricingSchema);
    const rule = await prisma.pricingRule.create({
      data: {
        ...input,
        specialDate: input.specialDate ? new Date(input.specialDate) : undefined,
        specialDateEnd: input.specialDateEnd ? new Date(input.specialDateEnd) : undefined,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
        createdById: authResult.auth.user.id,
      },
    });
    await writeAudit({ actorId: authResult.auth.user.id, action: "pricing.create", entityType: "PricingRule", entityId: rule.id, after: rule });
    return jsonData(rule, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
