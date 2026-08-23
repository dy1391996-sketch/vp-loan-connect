import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { draftAssessmentSchema } from "@/lib/domain/assessment-schema";
import { USP_PRODUCT_SLUG } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getPublicAppUrl } from "@/lib/env";
import { assertSameOrigin, rateLimit, sanitizeText } from "@/lib/security/request";
import { isAccessTokenError, signAccessToken, verifyAccessToken } from "@/lib/security/tokens";
import { normalizeIndianMobile } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const parsed = draftAssessmentSchema.safeParse(await request.json());
    if (!parsed.success) {
      const firstMessage = parsed.error.issues[0]?.message;
      return NextResponse.json(
        { error: firstMessage || "Complete email verification and loan need details first.", fields: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const input = parsed.data;
    const mobile = normalizeIndianMobile(input.mobile);
    const emailToken = await verifyAccessToken(input.otpVerificationToken, "otp_verified");
    if (emailToken.sub !== mobile || typeof emailToken.leadId !== "string") {
      return NextResponse.json({ error: "Email verification does not match this assessment." }, { status: 403 });
    }

    const tokenEmail =
      typeof (emailToken as { email?: unknown }).email === "string"
        ? String((emailToken as { email?: string }).email).toLowerCase()
        : "";
    if (!tokenEmail || tokenEmail !== input.email.toLowerCase()) {
      return NextResponse.json({ error: "Verified email does not match this assessment." }, { status: 403 });
    }

    const lead = await prisma.lead.findUnique({
      where: { id: emailToken.leadId },
      select: { id: true, mobile: true, deletedAt: true, stage: true },
    });
    if (!lead || lead.deletedAt || lead.mobile !== mobile) {
      return NextResponse.json({ error: "Complete email OTP verification again.", code: "EMAIL_OTP_VERIFICATION_REQUIRED" }, { status: 403 });
    }

    if (!rateLimit(`assessment-draft:${lead.id}`, 12, 60 * 60 * 1000).allowed) {
      return NextResponse.json({ error: "Too many checkout starts. Please try again later." }, { status: 429 });
    }

    const assessment = await prisma.$transaction(async (tx) => {
      const existing = await tx.assessment.findFirst({
        where: { leadId: lead.id, status: "STARTED" },
        orderBy: { createdAt: "desc" },
      });

      const sharedData = {
        loanAmount: input.loanAmount,
        loanPurpose: sanitizeText(input.loanPurpose),
        loanType: input.loanType,
        source: input.source,
        referralCode: input.referralCode || null,
        completionPercent: 25,
      };

      const answers = [
        { questionKey: "email", value: input.email as Prisma.InputJsonValue },
        { questionKey: "fullName", value: sanitizeText(input.fullName) as Prisma.InputJsonValue },
      ];

      if (existing) {
        await tx.assessment.update({
          where: { id: existing.id },
          data: sharedData,
        });
        await tx.lead.update({
          where: { id: lead.id },
          data: {
            fullName: sanitizeText(input.fullName),
            source: input.source,
            utm: input.utm ?? Prisma.JsonNull,
            referredByCode: input.referralCode || undefined,
            stage: lead.stage === "NEW_LEAD" || lead.stage === "OTP_VERIFIED" ? "ASSESSMENT_STARTED" : lead.stage,
          },
        });
        for (const answer of answers) {
          await tx.assessmentAnswer.upsert({
            where: { assessmentId_questionKey: { assessmentId: existing.id, questionKey: answer.questionKey } },
            update: { value: answer.value },
            create: { assessmentId: existing.id, questionKey: answer.questionKey, value: answer.value },
          });
        }
        return existing;
      }

      await tx.lead.update({
        where: { id: lead.id },
        data: {
          fullName: sanitizeText(input.fullName),
          source: input.source,
          utm: input.utm ?? Prisma.JsonNull,
          referredByCode: input.referralCode || undefined,
          stage: "ASSESSMENT_STARTED",
        },
      });

      return tx.assessment.create({
        data: {
          leadId: lead.id,
          status: "STARTED",
          ...sharedData,
          answers: { create: answers.map((item) => ({ questionKey: item.questionKey, value: item.value })) },
        },
      });
    });

    const accessToken = await signAccessToken("result_access", assessment.id, { leadId: lead.id }, "7d");
    return NextResponse.json({
      assessmentId: assessment.id,
      accessToken,
      status: "STARTED",
      checkoutUrl: `${getPublicAppUrl()}/checkout?product=${USP_PRODUCT_SLUG}&assessment=${assessment.id}&token=${encodeURIComponent(accessToken)}`,
    });
  } catch (error) {
    if (isAccessTokenError(error)) {
      return NextResponse.json({ error: "Complete email OTP verification again.", code: "OTP_VERIFICATION_REQUIRED" }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "unknown";
    console.error("assessment_draft_failed", message === "INVALID_ORIGIN" ? message : "server_error");
    if (message === "INVALID_ORIGIN") {
      return NextResponse.json({ error: "Please reload this page on www.vploanconnect.in and try again." }, { status: 403 });
    }
    return NextResponse.json({ error: "We could not start checkout. Please try again." }, { status: 500 });
  }
}
