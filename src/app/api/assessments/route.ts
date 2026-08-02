import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { assessmentSchema } from "@/lib/domain/assessment-schema";
import { estimateIndicativeCapacity } from "@/lib/domain/cross-field-rules";
import { maskPan } from "@/lib/domain/identity";
import { calculateReadiness, incomeRangeMidpoints, type ScoreInput } from "@/lib/domain/scoring";
import { CONSENT_VERSION, MARKETING_CONSENT_TEXT, SERVICE_CONSENT_TEXT } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getPublicAppUrl, getServerEnv } from "@/lib/env";
import { sendWhatsAppTemplate } from "@/lib/providers/whatsapp";
import { assertSameOrigin, rateLimit, requestIp, sanitizeText } from "@/lib/security/request";
import { signAccessToken, verifyAccessToken } from "@/lib/security/tokens";
import { normalizeIndianMobile } from "@/lib/utils";
import { isValidReferral } from "@/lib/domain/referrals";
import { getPanProvider } from "@/lib/providers/pan";

export const runtime = "nodejs";

function dataQualityWarnings(input: ScoreInput & { panVerificationStatus?: string }): string[] {
  const warnings: string[] = [];
  warnings.push("Indicative eligibility estimate, not a loan approval.");
  if (input.creditRange === "UNKNOWN") warnings.push("Credit range is self-reported as unknown — no bureau pull was performed.");
  if (!input.aadhaarAvailable || !input.incomeProofAvailable || !input.bankStatementAvailable) {
    warnings.push("Document readiness is user-declared and not file-verified on this platform.");
  }
  if (input.panVerificationStatus !== "verified_authorised_provider") {
    warnings.push("PAN format was validated only — identity not verified through an authorised KYC provider.");
  }
  if (input.existingEmi === 0) warnings.push("No existing EMI declared — repayment capacity assumes this is accurate.");
  return warnings;
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const raw = await request.json();
    const parsed = assessmentSchema.safeParse(raw);
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      const invalidFields = Object.keys(fields);
      const firstMessage = parsed.error.issues[0]?.message;
      console.warn("assessment_validation_failed", {
        invalidFields,
        issueCodes: parsed.error.issues.map((issue) => issue.code),
      });
      return NextResponse.json(
        {
          error: firstMessage || (invalidFields.length ? `Please check: ${invalidFields.join(", ")}.` : "Please review the assessment fields."),
          fields,
        },
        { status: 400 },
      );
    }

    const input = {
      ...parsed.data,
      // Server authority: never trust client-claimed authorised PAN verification.
      panVerificationStatus: "not_verified" as const,
      panFormatValidated: getPanProvider().checkFormat(parsed.data.panNumber).formatStatus === "format_valid",
    };

    const mobile = normalizeIndianMobile(input.mobile);
    const token = await verifyAccessToken(input.otpVerificationToken, "otp_verified");
    if (token.sub !== mobile || typeof token.leadId !== "string") {
      return NextResponse.json({ error: "Mobile verification does not match this assessment." }, { status: 403 });
    }

    const tokenEmail = typeof (token as { email?: unknown }).email === "string" ? String((token as { email?: string }).email).toLowerCase() : "";
    if (tokenEmail && tokenEmail !== input.email.toLowerCase()) {
      return NextResponse.json({ error: "Verified email does not match this assessment." }, { status: 403 });
    }

    if (!rateLimit(`assessment-submit:${token.leadId}`, 8, 60 * 60 * 1000).allowed) {
      return NextResponse.json({ error: "Too many assessment submissions. Please try again later." }, { status: 429 });
    }

    const scoreInput: ScoreInput = {
      loanAmount: input.loanAmount,
      loanType: input.loanType,
      employmentType: input.employmentType,
      monthlyIncomeRange: input.monthlyIncomeRange as keyof typeof incomeRangeMidpoints,
      durationMonths: input.durationMonths,
      salaryBankCredit: input.salaryBankCredit,
      itrAvailable: input.itrAvailable,
      gstAvailable: input.gstAvailable,
      udyamAvailable: input.udyamAvailable,
      sixMonthBankStatement: input.sixMonthBankStatement,
      existingEmi: input.existingEmi,
      activeLoans: input.activeLoans,
      cardOutstanding: input.cardOutstanding,
      currentOverdue: input.currentOverdue,
      settledOrWrittenOff: input.settledOrWrittenOff,
      creditRange: input.creditRange,
      panAvailable: input.panAvailable,
      aadhaarAvailable: input.aadhaarAvailable,
      addressProofAvailable: input.addressProofAvailable,
      incomeProofAvailable: input.incomeProofAvailable,
      bankStatementAvailable: input.bankStatementAvailable,
      businessRegistrationAvailable: input.businessRegistrationAvailable,
      securedAssetAvailable: input.securedAssetAvailable,
    };

    const result = calculateReadiness(scoreInput);
    const warnings = dataQualityWarnings({ ...scoreInput, panVerificationStatus: input.panVerificationStatus });
    result.improvements = [...warnings.filter((w) => !result.improvements.includes(w)), ...result.improvements];

    const capacity = estimateIndicativeCapacity({
      monthlyIncomeRange: input.monthlyIncomeRange,
      existingEmi: input.existingEmi,
      loanAmount: input.loanAmount,
    });

    const env = getServerEnv();
    const userAgent = request.headers.get("user-agent")?.slice(0, 500);
    const ipAddress = env.STORE_CONSENT_IP ? requestIp(request) : undefined;
    const answers = Object.entries(input).filter(
      ([key]) =>
        ![
          "otpVerificationToken",
          "serviceConsent",
          "marketingConsent",
          "fullName",
          "mobile",
          "state",
          "city",
          "loanAmount",
          "loanPurpose",
          "loanType",
          "source",
          "referralCode",
          "utm",
        ].includes(key),
    );

    console.info("assessment_submit_accepted", {
      leadId: token.leadId,
      pan: maskPan(input.panNumber),
      loanAmount: input.loanAmount,
      employmentType: input.employmentType,
    });

    const assessment = await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.update({
        where: { id: token.leadId as string },
        data: {
          fullName: sanitizeText(input.fullName),
          state: sanitizeText(input.state),
          city: sanitizeText(input.city),
          source: input.source,
          utm: input.utm ?? Prisma.JsonNull,
          referredByCode: input.referralCode || undefined,
          stage: "ASSESSMENT_COMPLETED",
        },
      });
      const created = await tx.assessment.create({
        data: {
          leadId: lead.id,
          status: "COMPLETED",
          loanAmount: input.loanAmount,
          loanPurpose: sanitizeText(input.loanPurpose),
          loanType: input.loanType,
          employmentType: input.employmentType,
          monthlyIncomeRange: input.monthlyIncomeRange,
          monthlyIncome: incomeRangeMidpoints[input.monthlyIncomeRange],
          existingEmi: input.existingEmi,
          creditRange: input.creditRange,
          source: input.source,
          referralCode: input.referralCode || null,
          completionPercent: 100,
          completedAt: new Date(),
          answers: {
            create: answers.map(([questionKey, value]) => ({
              questionKey,
              value: value as Prisma.InputJsonValue,
            })),
          },
          score: {
            create: {
              readinessScore: result.readinessScore,
              readinessLabel: result.readinessLabel,
              emiRatio: result.emiRatio,
              emiBurden: result.emiBurden,
              documentationStatus: result.documentationStatus,
              creditHealthStatus: result.creditHealthStatus,
              comfortableEmiMin: result.comfortableEmiMin,
              comfortableEmiMax: result.comfortableEmiMax,
              suitableCategories: result.suitableCategories,
              strengths: result.strengths,
              improvements: result.improvements,
              factorBreakdown: result.factorBreakdown as unknown as Prisma.InputJsonValue,
              engineVersion: result.engineVersion,
            },
          },
        },
      });
      await tx.consentLog.createMany({
        data: [
          {
            leadId: lead.id,
            consentType: "SERVICE",
            consentText: SERVICE_CONSENT_TEXT,
            consentVersion: CONSENT_VERSION,
            accepted: true,
            acceptedAt: new Date(),
            source: input.source,
            userAgent,
            ipAddress,
          },
          {
            leadId: lead.id,
            consentType: "MARKETING",
            consentText: MARKETING_CONSENT_TEXT,
            consentVersion: CONSENT_VERSION,
            accepted: input.marketingConsent,
            acceptedAt: input.marketingConsent ? new Date() : null,
            source: input.source,
            userAgent,
            ipAddress,
          },
        ],
      });

      if (input.referralCode) {
        const referrer = await tx.lead.findUnique({ where: { referralCode: input.referralCode } });
        if (
          referrer &&
          isValidReferral({
            referrerId: referrer.id,
            referredId: lead.id,
            referrerMobile: referrer.mobile,
            referredMobile: lead.mobile,
          })
        ) {
          await tx.referral.upsert({
            where: { referredLeadId: lead.id },
            update: {},
            create: { referrerLeadId: referrer.id, referredLeadId: lead.id, referralCode: input.referralCode },
          });
        }
      }
      return created;
    });

    const accessToken = await signAccessToken("result_access", assessment.id, { leadId: token.leadId as string }, "7d");
    const resultUrl = `${getPublicAppUrl()}/result/${assessment.id}?token=${encodeURIComponent(accessToken)}`;
    sendWhatsAppTemplate(token.leadId as string, "FREE_RESULT_READY", { link: resultUrl }).catch((error) =>
      console.error("whatsapp_result_failed", error instanceof Error ? error.message : "unknown"),
    );
    return NextResponse.json({
      assessmentId: assessment.id,
      accessToken,
      resultUrl,
      indicative: {
        readinessScore: result.readinessScore,
        readinessLabel: result.readinessLabel,
        ...capacity,
        disclaimer: "Indicative eligibility estimate, not a loan approval.",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("assessment_submit_failed", message);
    if (message === "INVALID_ORIGIN") {
      return NextResponse.json({ error: "Please reload this page on vploanconnect.in and try again." }, { status: 403 });
    }
    return NextResponse.json({ error: "We could not save your assessment. Please try again." }, { status: 500 });
  }
}
