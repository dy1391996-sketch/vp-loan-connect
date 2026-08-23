import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { USP_PRODUCT_SLUG } from "@/lib/constants";
import { assertSameOrigin, rateLimit } from "@/lib/security/request";
import { isAccessTokenError, verifyAccessToken } from "@/lib/security/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  assessmentId: z.string().uuid(),
  resultToken: z.string().min(20),
});

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Secure assessment access required." }, { status: 400 });
    }

    const token = await verifyAccessToken(parsed.data.resultToken, "result_access");
    if (token.sub !== parsed.data.assessmentId || typeof token.leadId !== "string") {
      return NextResponse.json({ error: "Secure assessment access is invalid." }, { status: 403 });
    }
    if (!rateLimit(`assessment-entitlement:${token.leadId}`, 30, 10 * 60 * 1000).allowed) {
      return NextResponse.json({ error: "Too many status checks. Please wait." }, { status: 429 });
    }

    const assessment = await prisma.assessment.findUnique({
      where: { id: parsed.data.assessmentId },
      include: {
        score: { select: { id: true } },
        orders: {
          where: { status: "PAID", product: { slug: USP_PRODUCT_SLUG } },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!assessment || assessment.leadId !== token.leadId) {
      return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
    }

    return NextResponse.json({
      assessmentId: assessment.id,
      status: assessment.status,
      paid: assessment.orders.length > 0,
      hasScore: Boolean(assessment.score),
    });
  } catch (error) {
    if (isAccessTokenError(error)) {
      return NextResponse.json({ error: "Secure assessment access is invalid." }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "unknown";
    if (message === "INVALID_ORIGIN") return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    console.error("assessment_entitlement_failed", "server_error");
    return NextResponse.json({ error: "Unable to read payment entitlement." }, { status: 500 });
  }
}
