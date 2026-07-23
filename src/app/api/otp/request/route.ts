import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { sendOtp } from "@/lib/providers/otp";
import { assertSameOrigin, rateLimit, requestIpHash, sanitizeText } from "@/lib/security/request";
import { generateReferralCode, normalizeIndianMobile } from "@/lib/utils";

const schema = z.object({ fullName: z.string().trim().min(2).max(100), mobile: z.string().regex(/^[6-9]\d{9}$/), source: z.string().max(120).optional() });

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Please enter a valid name and 10-digit Indian mobile number." }, { status: 400 });
    const mobile = normalizeIndianMobile(parsed.data.mobile);
    const ipHash = requestIpHash(request);
    const limiter = rateLimit(`otp:${mobile}`, 5, 10 * 60 * 1000);
    const ipLimiter = rateLimit(`otp-ip:${ipHash ?? "unknown"}`, 20, 10 * 60 * 1000);
    if (!limiter.allowed || !ipLimiter.allowed) return NextResponse.json({ error: "Too many OTP requests. Please try again later." }, { status: 429, headers: { "Retry-After": String(limiter.retryAfter ?? 600) } });

    let lead = await prisma.lead.findUnique({ where: { mobile } });
    if (!lead) {
      for (let attempt = 0; attempt < 3 && !lead; attempt += 1) {
        try {
          lead = await prisma.lead.create({ data: { mobile, fullName: sanitizeText(parsed.data.fullName), source: parsed.data.source ?? "direct", referralCode: generateReferralCode(`${mobile}:${attempt}`) } });
        } catch (error) {
          if (attempt === 2) throw error;
        }
      }
    } else if (!lead.deletedAt) {
      lead = await prisma.lead.update({ where: { id: lead.id }, data: { fullName: sanitizeText(parsed.data.fullName), source: parsed.data.source ?? lead.source } });
    }
    if (!lead || lead.deletedAt) return NextResponse.json({ error: "This profile is not available. Contact support." }, { status: 403 });

    const env = getServerEnv();
    const code = env.OTP_PROVIDER === "mock" ? env.MOCK_OTP_CODE : String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const otp = await prisma.otpRequest.create({ data: { leadId: lead.id, mobile, otpHash, expiresAt, ipHash, userAgent: request.headers.get("user-agent")?.slice(0, 500) } });
    const sent = await sendOtp(mobile, code);
    await prisma.otpRequest.update({ where: { id: otp.id }, data: { providerRef: sent.providerRef } });
    return NextResponse.json({ requestId: otp.id, expiresAt: expiresAt.toISOString(), ...(sent.developmentCode ? { developmentCode: sent.developmentCode } : {}) });
  } catch (error) {
    console.error("otp_request_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Unable to send OTP right now. Please try again." }, { status: 500 });
  }
}
