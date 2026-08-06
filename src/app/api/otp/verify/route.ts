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
  email: z.string().trim().email().max(254),
  source: z.string().max(120).optional(),
  accessToken: z.string().min(10).max(8192),
});

const VERIFY_ACCESS_TOKEN_URLS = [
  "https://control.msg91.com/api/v5/widget/verifyAccessToken",
  "https://api.msg91.com/api/v5/widget/verifyAccessToken",
] as const;

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const json = Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(json) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function collectIdentifierCandidates(value: unknown, into: string[], depth = 0): void {
  if (depth > 6 || value == null) return;
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (trimmed) into.push(trimmed);
    if (trimmed.split(".").length === 3) {
      const payload = decodeJwtPayload(trimmed);
      if (payload) collectIdentifierCandidates(payload, into, depth + 1);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectIdentifierCandidates(item, into, depth + 1);
    return;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectIdentifierCandidates(item, into, depth + 1);
    }
  }
}

function containsVerifiedIdentifier(value: unknown, expectedEmail: string): boolean {
  const expected = expectedEmail.trim().toLowerCase();
  const candidates: string[] = [];
  collectIdentifierCandidates(value, candidates);
  return candidates.some((item) => item === expected || item.includes(expected));
}

function providerError(value: unknown) {
  if (!value || typeof value !== "object") return "MSG91 could not verify this OTP.";
  const record = value as Record<string, unknown>;
  return typeof record.message === "string" && record.message.trim() ? record.message : "MSG91 could not verify this OTP.";
}

async function verifyMsg91AccessToken(accessToken: string, authkey: string) {
  let lastStatus = 0;
  let lastData: unknown = {};
  for (const url of VERIFY_ACCESS_TOKEN_URLS) {
    const providerResponse = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authkey },
      body: JSON.stringify({ "access-token": accessToken }),
      cache: "no-store",
    });
    let providerData: unknown = {};
    try {
      providerData = await providerResponse.json();
    } catch {
      providerData = {};
    }
    lastStatus = providerResponse.status;
    lastData = providerData;
    const isError =
      !providerResponse.ok ||
      (providerData && typeof providerData === "object" && (providerData as Record<string, unknown>).type === "error");
    if (!isError) return { ok: true as const, status: providerResponse.status, data: providerData };
  }
  return { ok: false as const, status: lastStatus, data: lastData };
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Complete email OTP verification again." }, { status: 400 });

    const mobile = normalizeIndianMobile(parsed.data.mobile);
    if (!rateLimit(`otp-widget-verify:${mobile}`, 8, 10 * 60 * 1000).allowed) {
      return NextResponse.json({ error: "Too many verification attempts. Please try again later." }, { status: 429 });
    }

    const env = getServerEnv();
    if (!env.OTP_API_KEY) return NextResponse.json({ error: "OTP verification is not configured." }, { status: 503 });

    const provider = await verifyMsg91AccessToken(parsed.data.accessToken, env.OTP_API_KEY);
    if (!provider.ok) {
      console.error("msg91_widget_access_token_rejected", { status: provider.status, message: providerError(provider.data) });
      return NextResponse.json({ error: "OTP verification failed or expired. Please try again." }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase();
    if (!containsVerifiedIdentifier(provider.data, email) && !containsVerifiedIdentifier(parsed.data.accessToken, email)) {
      console.error("msg91_widget_identifier_mismatch", { status: provider.status });
      return NextResponse.json({ error: "Verified email address did not match. Please try again." }, { status: 400 });
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

    // Email widget proves ownership of the submitted email and binds it to this lead/mobile contact.
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        stage: lead.stage === "NEW_LEAD" ? "OTP_VERIFIED" : lead.stage,
        mobileVerifiedAt: lead.mobileVerifiedAt ?? new Date(),
        mobileVerificationMethod: "EMAIL",
      },
    });
    const verificationToken = await signAccessToken(
      "otp_verified",
      mobile,
      { leadId: lead.id, provider: "msg91_email_widget", email },
      "20m",
    );
    return NextResponse.json({ verified: true, verificationToken, channel: "email" });
  } catch (error) {
    console.error("otp_widget_verify_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Unable to verify OTP right now." }, { status: 500 });
  }
}
