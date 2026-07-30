import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { assertSameOrigin, rateLimit, sanitizeText } from "@/lib/security/request";
import { signAccessToken } from "@/lib/security/tokens";
import { generateReferralCode, normalizeIndianMobile } from "@/lib/utils";

const schema = z.object({
  fullName: z.string().trim().min(2).max(100),
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  source: z.string().max(120).optional(),
  accessToken: z.string().min(10).max(8192),
});

function containsVerifiedIdentifier(value: unknown, expectedMobile: string): boolean {
  if (typeof value === "string") {
    const digits = value.replace(/\D/g, "");
    return digits === expectedMobile || digits === expectedMobile.slice(2);
  }
  if (Array.isArray(value)) return value.some((item) => containsVerifiedIdentifier(item, expectedMobile));
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).some((item) => containsVerifiedIdentifier(item, expectedMobile));
  return false;
}

function providerError(value: unknown) {
  if (!value || typeof value !== "object") return "MSG91 could not verify this OTP.";
  const record = value as Record<string, unknown>;
  return typeof record.message === "string" && record.message.trim() ? record.message : "MSG91 could not verify this OTP.";
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Complete SMS OTP verification again." }, { status: 400 });

    const mobile = normalizeIndianMobile(parsed.data.mobile);
    if (!rateLimit(`otp-widget-verify:${mobile}`, 8, 10 * 60 * 1000).allowed) {
      return NextResponse.json({ error: "Too many verification attempts. Please try again later." }, { status: 429 });
    }

    const env = getServerEnv();
    if (!env.OTP_API_KEY) return NextResponse.json({ error: "OTP verification is not configured." }, { status: 503 });

    const providerResponse = await fetch("https://api.msg91.com/api/v5/widget/verifyAccessToken", {
      method: "POST",
      headers: { "content-type": "application/json", authkey: env.OTP_API_KEY },
      body: JSON.stringify({ "access-token": parsed.data.accessToken }),
      cache: "no-store",
    });

    let providerData: unknown = {};
    try { providerData = await providerResponse.json(); } catch { providerData = {}; }

    if (!providerResponse.ok || (providerData && typeof providerData === "object" && (providerData as Record<string, unknown>).type === "error")) {
      console.error("msg91_widget_access_token_rejected", { status: providerResponse.status, message: providerError(providerData) });
      return NextResponse.json({ error: "OTP verification failed or expired. Please try again." }, { status: 400 });
    }

    if (!containsVerifiedIdentifier(providerData, mobile)) {
      console.error("msg91_widget_identifier_mismatch", { status: providerResponse.status });
      return NextResponse.json({ error: "Verified mobile number did not match. Please try again." }, { status: 400 });
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
              referralCode: generateReferralCode(`${mobile}:widget:${attempt}`),
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

    if (!lead || lead.deletedAt) return NextResponse.json({ error: "This profile is not available. Contact support." }, { status: 403 });

    const verifiedAt = new Date();
    await prisma.lead.update({ where: { id: lead.id }, data: { mobileVerifiedAt: verifiedAt, stage: "OTP_VERIFIED" } });
    const verificationToken = await signAccessToken("otp_verified", mobile, { leadId: lead.id, provider: "msg91_widget" }, "20m");
    return NextResponse.json({ verified: true, verificationToken });
  } catch (error) {
    console.error("otp_widget_verify_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Unable to verify OTP right now." }, { status: 500 });
  }
}
