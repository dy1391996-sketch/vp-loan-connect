import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { jsonData, parseJsonBody, routeError, type RouteContext } from "@/lib/api/route-helpers";

const schema = z.object({ body: z.string().min(1).max(4000) });

export async function POST(request: NextRequest, context: RouteContext) {
  const authResult = await requireApiUser(request, "inbox:manage");
  if ("error" in authResult) return authResult.error;
  try {
    const { id } = await context.params;
    const input = await parseJsonBody(request, schema);
    const note = await prisma.conversationNote.create({
      data: {
        conversationId: id,
        authorId: authResult.auth.user.id,
        body: input.body,
      },
      include: { author: true },
    });
    return jsonData(note, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
