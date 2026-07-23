import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertSameOrigin, rateLimit } from "@/lib/security/request";
import { signAccessToken } from "@/lib/security/tokens";
import { normalizeIndianMobile } from "@/lib/utils";

const schema = z.object({ requestId: z.string().uuid(), mobile: z.string().regex(/^[6-9]\d{9}$/), code: z.string().regex(/^\d{6}$/) });

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Enter the 6-digit OTP." }, { status: 400 });
    const mobile = normalizeIndianMobile(parsed.data.mobile);
    if (!rateLimit(`otp-verify:${parsed.data.requestId}`, 6, 10 * 60 * 1000).allowed) return NextResponse.json({ error: "Too many attempts. Request a new OTP." }, { status: 429 });
    const otp = await prisma.otpRequest.findUnique({ where: { id: parsed.data.requestId } });
    if (!otp || otp.mobile !== mobile || otp.verifiedAt || otp.expiresAt < new Date() || otp.attemptCount >= 5) return NextResponse.json({ error: "OTP is expired or invalid. Request a new OTP." }, { status: 400 });
    const valid = await bcrypt.compare(parsed.data.code, otp.otpHash);
    if (!valid) {
      await prisma.otpRequest.update({ where: { id: otp.id }, data: { attemptCount: { increment: 1 } } });
      return NextResponse.json({ error: "Incorrect OTP. Please check and try again." }, { status: 400 });
    }
    const verifiedAt = new Date();
    await prisma.$transaction([
      prisma.otpRequest.update({ where: { id: otp.id }, data: { verifiedAt } }),
      prisma.lead.update({ where: { id: otp.leadId! }, data: { mobileVerifiedAt: verifiedAt, stage: "OTP_VERIFIED" } }),
    ]);
    const verificationToken = await signAccessToken("otp_verified", mobile, { leadId: otp.leadId!, otpRequestId: otp.id }, "20m");
    return NextResponse.json({ verified: true, verificationToken });
  } catch (error) {
    console.error("otp_verify_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Unable to verify OTP right now." }, { status: 500 });
  }
}
