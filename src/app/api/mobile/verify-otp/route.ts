import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  MOBILE_OTP_CONSUMED_HASH,
  MOBILE_OTP_MAX_ATTEMPTS,
  MOBILE_OTP_MESSAGES,
  compareMobileOtp,
  evaluateMobileOtpVerify,
  parseIndianMobileInput,
} from "@/lib/security/mobile-otp";
import { assertSameOrigin, rateLimit, requestIpHash, sanitizeText } from "@/lib/security/request";
import { signAccessToken } from "@/lib/security/tokens";
import { generateReferralCode, redactMobile } from "@/lib/utils";

export const runtime = "nodejs";

const schema = z.object({
  requestId: z.string().uuid(),
  mobile: z.string().trim().min(10).max(16),
  code: z.string().trim().regex(/^\d{6}$/),
  fullName: z.string().trim().min(2).max(100).optional(),
  source: z.string().trim().max(120).optional(),
});

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: MOBILE_OTP_MESSAGES.INVALID_OTP, code: "INVALID_OTP" }, { status: 400 });
    }

    let mobile: string;
    try {
      mobile = parseIndianMobileInput(parsed.data.mobile);
    } catch {
      return NextResponse.json({ error: MOBILE_OTP_MESSAGES.INVALID_MOBILE, code: "INVALID_MOBILE" }, { status: 400 });
    }

    const ipHash = requestIpHash(request);
    const mobileLimiter = rateLimit(`mobile-otp-verify:${mobile}`, 12, 10 * 60 * 1000);
    const ipLimiter = rateLimit(`mobile-otp-verify-ip:${ipHash ?? "unknown"}`, 30, 10 * 60 * 1000);
    if (!mobileLimiter.allowed || !ipLimiter.allowed) {
      return NextResponse.json(
        { error: MOBILE_OTP_MESSAGES.RATE_LIMITED, code: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(mobileLimiter.retryAfter ?? ipLimiter.retryAfter ?? 600) } },
      );
    }

    const otp = await prisma.otpRequest.findUnique({ where: { id: parsed.data.requestId } });
    if (!otp) {
      return NextResponse.json({ error: MOBILE_OTP_MESSAGES.OTP_NOT_FOUND, code: "OTP_NOT_FOUND" }, { status: 404 });
    }

    const gate = evaluateMobileOtpVerify(
      {
        mobile: otp.mobile,
        otpHash: otp.otpHash,
        attemptCount: otp.attemptCount,
        resendCount: otp.resendCount,
        expiresAt: otp.expiresAt,
        verifiedAt: otp.verifiedAt,
        lastSentAt: otp.lastSentAt,
      },
      mobile,
    );

    if (!gate.ok) {
      const status = gate.code === "TOO_MANY_ATTEMPTS" || gate.code === "MOBILE_MISMATCH" ? 403 : 400;
      console.info("mobile_otp_verify_rejected", { mobile: redactMobile(mobile), reason: gate.code, requestId: otp.id });
      return NextResponse.json({ error: MOBILE_OTP_MESSAGES[gate.code], code: gate.code }, { status });
    }

    const matches = await compareMobileOtp(parsed.data.code, otp.otpHash);
    if (!matches) {
      const nextAttempts = otp.attemptCount + 1;
      await prisma.otpRequest.update({
        where: { id: otp.id },
        data: {
          attemptCount: nextAttempts,
          ...(nextAttempts >= MOBILE_OTP_MAX_ATTEMPTS
            ? { otpHash: MOBILE_OTP_CONSUMED_HASH, expiresAt: new Date() }
            : {}),
        },
      });
      const code = nextAttempts >= MOBILE_OTP_MAX_ATTEMPTS ? "TOO_MANY_ATTEMPTS" : "INVALID_OTP";
      console.info("mobile_otp_verify_rejected", { mobile: redactMobile(mobile), reason: code, requestId: otp.id, attempts: nextAttempts });
      return NextResponse.json(
        { error: MOBILE_OTP_MESSAGES[code], code },
        { status: code === "TOO_MANY_ATTEMPTS" ? 403 : 400 },
      );
    }

    const verifiedAt = new Date();
    await prisma.otpRequest.update({
      where: { id: otp.id },
      data: { verifiedAt, otpHash: MOBILE_OTP_CONSUMED_HASH, attemptCount: otp.attemptCount + 1 },
    });

    let lead = otp.leadId ? await prisma.lead.findUnique({ where: { id: otp.leadId } }) : await prisma.lead.findUnique({ where: { mobile } });
    if (!lead) {
      for (let attempt = 0; attempt < 3 && !lead; attempt += 1) {
        try {
          lead = await prisma.lead.create({
            data: {
              mobile,
              fullName: sanitizeText(parsed.data.fullName || "Applicant"),
              source: parsed.data.source ?? "direct",
              referralCode: generateReferralCode(`${mobile}:sms-verify:${attempt}`),
              mobileVerifiedAt: verifiedAt,
              mobileVerificationMethod: "SMS",
              stage: "OTP_VERIFIED",
            },
          });
        } catch (error) {
          lead = await prisma.lead.findUnique({ where: { mobile } });
          if (attempt === 2 && !lead) throw error;
        }
      }
    }

    if (!lead || lead.deletedAt) {
      return NextResponse.json({ error: "This profile is not available. Contact support." }, { status: 403 });
    }

    lead = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        mobileVerifiedAt: verifiedAt,
        mobileVerificationMethod: "SMS",
        stage: lead.stage === "NEW_LEAD" ? "OTP_VERIFIED" : lead.stage,
        ...(parsed.data.fullName ? { fullName: sanitizeText(parsed.data.fullName) } : {}),
      },
    });

    const verificationToken = await signAccessToken(
      "mobile_otp_verified",
      mobile,
      { leadId: lead.id, provider: "msg91_sms", method: "SMS" },
      "20m",
    );

    console.info("mobile_otp_verified", { mobile: redactMobile(mobile), requestId: otp.id, leadId: lead.id });

    return NextResponse.json({
      verified: true,
      verifiedAt: verifiedAt.toISOString(),
      method: "SMS",
      verificationToken,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("mobile_otp_verify_failed", message === "INVALID_ORIGIN" ? message : "unknown");
    if (message === "INVALID_ORIGIN") {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unable to verify mobile OTP right now." }, { status: 500 });
  }
}
