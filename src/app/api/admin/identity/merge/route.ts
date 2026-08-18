import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { writeAudit } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { jsonData, parseJsonBody, routeError } from "@/lib/api/route-helpers";
import { jsonError } from "@/lib/auth/api";

const schema = z.object({
  customerAId: z.string().min(1),
  customerBId: z.string().min(1),
  note: z.string().max(500).optional(),
});

/** Admin-only verified identity merge link — never callable by customers. */
export async function POST(request: NextRequest) {
  const authResult = await requireApiUser(request, "settings:manage");
  if ("error" in authResult) return authResult.error;
  try {
    const input = await parseJsonBody(request, schema);
    if (input.customerAId === input.customerBId) {
      return jsonError("Cannot link a customer to itself.", 400);
    }
    const [a, b] =
      input.customerAId < input.customerBId
        ? [input.customerAId, input.customerBId]
        : [input.customerBId, input.customerAId];
    const link = await prisma.identityLink.upsert({
      where: { customerAId_customerBId: { customerAId: a, customerBId: b } },
      create: {
        customerAId: a,
        customerBId: b,
        status: "VERIFIED_MATCH",
        method: "admin_merge",
        note: input.note,
        createdById: authResult.auth.user.id,
        verifiedAt: new Date(),
      },
      update: {
        status: "VERIFIED_MATCH",
        method: "admin_merge",
        note: input.note,
        createdById: authResult.auth.user.id,
        verifiedAt: new Date(),
      },
    });
    await writeAudit({
      actorId: authResult.auth.user.id,
      action: "identity.verify_merge",
      entityType: "IdentityLink",
      entityId: link.id,
      after: link,
    });
    return jsonData(link, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
