import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertSameOrigin, rateLimit, requestIpHash, sanitizeText } from "@/lib/security/request";
import { isAccessTokenError, verifyAccessToken } from "@/lib/security/tokens";
import { normalizeIndianMobile } from "@/lib/utils";

const schema = z.object({
  verificationToken: z.string().min(20),
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  reason: z.string().max(1000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid deletion request." }, { status: 400 });

    const mobile = normalizeIndianMobile(parsed.data.mobile);
    const ipHash = requestIpHash(request) ?? "unknown";
    if (!rateLimit(`data-deletion:${mobile}`, 5, 60 * 60 * 1000).allowed || !rateLimit(`data-deletion-ip:${ipHash}`, 20, 60 * 60 * 1000).allowed) {
      return NextResponse.json({ error: "Too many deletion requests. Please try again later." }, { status: 429 });
    }

    // Prefer SMS-verified tokens only (data-deletion form uses /api/mobile/*).
    let leadId: string | undefined;
    try {
      const mobileToken = await verifyAccessToken(parsed.data.verificationToken, "mobile_otp_verified");
      if (mobileToken.sub === mobile && typeof mobileToken.leadId === "string") leadId = mobileToken.leadId;
    } catch (error) {
      if (!isAccessTokenError(error)) throw error;
    }
    if (!leadId) return NextResponse.json({ error: "Complete mobile SMS OTP verification again." }, { status: 403 });

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.dataDeletionRequest.create({
        data: {
          leadId,
          mobile,
          reason: parsed.data.reason ? sanitizeText(parsed.data.reason) : null,
          status: "REQUESTED",
          verifiedAt: new Date(),
        },
      });
      await tx.lead.update({ where: { id: leadId }, data: { deletionRequestedAt: new Date() } });
      return item;
    });
    return NextResponse.json({ requestId: result.id, status: result.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("deletion_request_failed", message === "INVALID_ORIGIN" ? message : "server_error");
    if (message === "INVALID_ORIGIN") return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    return NextResponse.json({ error: "Unable to record deletion request." }, { status: 500 });
  }
}
