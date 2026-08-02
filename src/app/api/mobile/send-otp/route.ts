import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { sendOtp } from "@/lib/providers/otp";
import {
  MOBILE_OTP_MAX_RESENDS,
  MOBILE_OTP_MESSAGES,
  evaluateMobileOtpResend,
  generateMobileOtpCode,
  hashMobileOtp,
  mobileOtpExpiresAt,
  parseIndianMobileInput,
  resendAvailableAt,
} from "@/lib/security/mobile-otp";
import { assertSameOrigin, rateLimit, requestIpHash, sanitizeText } from "@/lib/security/request";
import { generateReferralCode, redactMobile } from "@/lib/utils";

export const runtime = "nodejs";

const schema = z.object({
  fullName: z.string().trim().min(2).max(100),
  mobile: z.string().trim().min(10).max(16),
  source: z.string().trim().max(120).optional(),
  requestId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: MOBILE_OTP_MESSAGES.INVALID_MOBILE, code: "INVALID_MOBILE" }, { status: 400 });
    }

    let mobile: string;
    try {
      mobile = parseIndianMobileInput(parsed.data.mobile);
    } catch {
      return NextResponse.json({ error: MOBILE_OTP_MESSAGES.INVALID_MOBILE, code: "INVALID_MOBILE" }, { status: 400 });
    }

    const ipHash = requestIpHash(request);
    const mobileLimiter = rateLimit(`mobile-otp-send:${mobile}`, 6, 15 * 60 * 1000);
    const ipLimiter = rateLimit(`mobile-otp-send-ip:${ipHash ?? "unknown"}`, 20, 15 * 60 * 1000);
    if (!mobileLimiter.allowed || !ipLimiter.allowed) {
      return NextResponse.json(
        { error: MOBILE_OTP_MESSAGES.RATE_LIMITED, code: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(mobileLimiter.retryAfter ?? ipLimiter.retryAfter ?? 600) } },
      );
    }

    let lead = await prisma.lead.findUnique({ where: { mobile } });
    if (!lead) {
      for (let attempt = 0; attempt < 3 && !lead; attempt += 1) {
        try {
          lead = await prisma.lead.create({
            data: {
              mobile,
              fullName: sanitizeText(parsed.data.fullName),
              source: parsed.data.source ?? "direct",
              referralCode: generateReferralCode(`${mobile}:sms:${attempt}`),
            },
          });
        } catch (error) {
          lead = await prisma.lead.findUnique({ where: { mobile } });
          if (attempt === 2 && !lead) throw error;
        }
      }
    } else if (!lead.deletedAt) {
      lead = await prisma.lead.update({
        where: { id: lead.id },
        data: { fullName: sanitizeText(parsed.data.fullName), source: parsed.data.source ?? lead.source },
      });
    }
    if (!lead || lead.deletedAt) {
      return NextResponse.json({ error: "This profile is not available. Contact support." }, { status: 403 });
    }

    const now = new Date();
    let existing =
      (parsed.data.requestId
        ? await prisma.otpRequest.findUnique({ where: { id: parsed.data.requestId } })
        : null) ??
      (await prisma.otpRequest.findFirst({
        where: { mobile, verifiedAt: null },
        orderBy: { createdAt: "desc" },
      }));

    // Fresh cycle when prior OTP expired or already consumed.
    if (existing && existing.mobile !== mobile) {
      existing = null;
    }
    if (existing?.verifiedAt) {
      existing = null;
    }
    if (existing && existing.expiresAt.getTime() <= now.getTime()) {
      existing = null;
    }

    const env = getServerEnv();
    const code = generateMobileOtpCode(env.OTP_PROVIDER === "mock" ? env.MOCK_OTP_CODE : undefined);
    const otpHash = await hashMobileOtp(code);
    const expiresAt = mobileOtpExpiresAt(now);
    const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? undefined;

    let otpId: string;
    let resendCount = 0;
    let lastSentAt = now;

    if (existing) {
      const resendCheck = evaluateMobileOtpResend(
        {
          mobile: existing.mobile,
          otpHash: existing.otpHash,
          attemptCount: existing.attemptCount,
          resendCount: existing.resendCount,
          expiresAt: existing.expiresAt,
          verifiedAt: existing.verifiedAt,
          lastSentAt: existing.lastSentAt,
        },
        mobile,
        now,
      );
      if (!resendCheck.ok) {
        const status = resendCheck.code === "RESEND_COOLDOWN" || resendCheck.code === "MAX_RESENDS" ? 429 : 400;
        return NextResponse.json(
          { error: MOBILE_OTP_MESSAGES[resendCheck.code], code: resendCheck.code },
          {
            status,
            headers: resendCheck.retryAfterSec ? { "Retry-After": String(resendCheck.retryAfterSec) } : undefined,
          },
        );
      }

      const updated = await prisma.otpRequest.update({
        where: { id: existing.id },
        data: {
          otpHash,
          expiresAt,
          attemptCount: 0,
          resendCount: existing.resendCount + 1,
          lastSentAt: now,
          ipHash,
          userAgent,
          leadId: lead.id,
        },
      });
      otpId = updated.id;
      resendCount = updated.resendCount;
      lastSentAt = updated.lastSentAt;
    } else {
      const created = await prisma.otpRequest.create({
        data: {
          leadId: lead.id,
          mobile,
          otpHash,
          expiresAt,
          lastSentAt: now,
          ipHash,
          userAgent,
          resendCount: 0,
          attemptCount: 0,
        },
      });
      otpId = created.id;
      resendCount = 0;
      lastSentAt = created.lastSentAt;
    }

    const sent = await sendOtp(mobile, code);
    await prisma.otpRequest.update({ where: { id: otpId }, data: { providerRef: sent.providerRef } });

    console.info("mobile_otp_sent", {
      mobile: redactMobile(mobile),
      requestId: otpId,
      resendCount,
      providerRef: sent.providerRef,
    });

    return NextResponse.json({
      requestId: otpId,
      expiresAt: expiresAt.toISOString(),
      resendAvailableAt: resendAvailableAt(lastSentAt).toISOString(),
      resendsRemaining: Math.max(0, MOBILE_OTP_MAX_RESENDS - resendCount),
      ...(sent.developmentCode ? { developmentCode: sent.developmentCode } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("mobile_otp_send_failed", message.includes("OTP") || message.includes("MSG91") ? message : "unknown");
    if (message === "INVALID_ORIGIN") {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
    if (message.includes("not configured") || message.includes("template_id")) {
      return NextResponse.json({ error: "Mobile OTP is not configured. Please try again later." }, { status: 503 });
    }
    return NextResponse.json({ error: "Unable to send mobile OTP right now. Please try again." }, { status: 500 });
  }
}
