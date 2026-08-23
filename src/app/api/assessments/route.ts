import { NextRequest, NextResponse } from "next/server";
import { Prisma, type Assessment } from "@prisma/client";
import { assessmentSchema, COMPLETE_ASSESSMENT_EXCLUDED_ANSWER_KEYS, type AssessmentPayload } from "@/lib/domain/assessment-schema";
import { estimateIndicativeCapacity } from "@/lib/domain/cross-field-rules";
import { boosterCheckoutHref } from "@/lib/apply/funnel-order";
import { buildPaymentReportSnapshot } from "@/lib/domain/early-checkout";
import { paidAssessmentGate, readBoosterEntitlement } from "@/lib/payments/entitlement";
import { maskPan } from "@/lib/domain/identity";
import { calculateReadiness, incomeRangeMidpoints, type ScoreInput } from "@/lib/domain/scoring";
import { CONSENT_VERSION, MARKETING_CONSENT_TEXT, SERVICE_CONSENT_TEXT, USP_PRODUCT_SLUG } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getPublicAppUrl, getServerEnv } from "@/lib/env";
import { sendWhatsAppTemplate } from "@/lib/providers/whatsapp";
import { assertSameOrigin, rateLimit, requestIp, sanitizeText } from "@/lib/security/request";
import { signAccessToken, verifyAccessToken, isAccessTokenError } from "@/lib/security/tokens";
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

type AssessmentAuth = { leadId: string; mobile: string };

async function resolveAssessmentAuth(input: AssessmentPayload): Promise<AssessmentAuth | NextResponse> {
  const mobile = normalizeIndianMobile(input.mobile);

  if (input.draftAssessmentId && input.resultToken && !input.otpVerificationToken) {
    const token = await verifyAccessToken(input.resultToken, "result_access");
    if (token.sub !== input.draftAssessmentId || typeof token.leadId !== "string") {
      return NextResponse.json({ error: "Secure assessment access is invalid." }, { status: 403 });
    }
    const [draft, lead] = await Promise.all([
      prisma.assessment.findUnique({
        where: { id: input.draftAssessmentId },
        include: { answers: { where: { questionKey: "email" }, take: 1 } },
      }),
      prisma.lead.findUnique({ where: { id: token.leadId }, select: { id: true, mobile: true, deletedAt: true } }),
    ]);
    if (!draft || draft.leadId !== token.leadId) {
      return NextResponse.json({ error: "Draft assessment was not found." }, { status: 404 });
    }
    if (!lead || lead.deletedAt || lead.mobile !== mobile) {
      return NextResponse.json({ error: "Complete email OTP verification again.", code: "EMAIL_OTP_VERIFICATION_REQUIRED" }, { status: 403 });
    }
    const storedEmail = typeof draft.answers[0]?.value === "string" ? String(draft.answers[0].value).toLowerCase() : "";
    if (storedEmail && storedEmail !== input.email.toLowerCase()) {
      return NextResponse.json({ error: "Verified email does not match this assessment." }, { status: 403 });
    }
    return { leadId: lead.id, mobile };
  }

  if (!input.otpVerificationToken) {
    return NextResponse.json({ error: "Complete email OTP verification first." }, { status: 403 });
  }

  const emailToken = await verifyAccessToken(input.otpVerificationToken, "otp_verified");
  if (emailToken.sub !== mobile || typeof emailToken.leadId !== "string") {
    return NextResponse.json({ error: "Email verification does not match this assessment." }, { status: 403 });
  }
  const tokenEmail =
    typeof (emailToken as { email?: unknown }).email === "string" ? String((emailToken as { email?: string }).email).toLowerCase() : "";
  if (!tokenEmail || tokenEmail !== input.email.toLowerCase()) {
    return NextResponse.json({ error: "Verified email does not match this assessment." }, { status: 403 });
  }
  const leadGate = await prisma.lead.findUnique({
    where: { id: emailToken.leadId },
    select: { id: true, mobile: true, deletedAt: true },
  });
  if (!leadGate || leadGate.deletedAt || leadGate.mobile !== mobile) {
    return NextResponse.json({ error: "Complete email OTP verification again.", code: "EMAIL_OTP_VERIFICATION_REQUIRED" }, { status: 403 });
  }
  if (input.draftAssessmentId) {
    const draft = await prisma.assessment.findUnique({ where: { id: input.draftAssessmentId }, select: { id: true, leadId: true } });
    if (!draft || draft.leadId !== leadGate.id) {
      return NextResponse.json({ error: "Draft assessment was not found." }, { status: 404 });
    }
  }
  return { leadId: leadGate.id, mobile };
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

    const auth = await resolveAssessmentAuth(input);
    if (auth instanceof NextResponse) return auth;

    if (!rateLimit(`assessment-submit:${auth.leadId}`, 8, 60 * 60 * 1000).allowed) {
      return NextResponse.json({ error: "Too many assessment submissions. Please try again later." }, { status: 429 });
    }

    if (!input.draftAssessmentId) {
      return NextResponse.json(
        {
          error: "Unlock the Credit Profile Booster before completing the detailed assessment.",
          code: "PAYMENT_REQUIRED",
          checkoutUrl: "/apply/quick",
        },
        { status: 402 },
      );
    }

    const entitlement = await readBoosterEntitlement(input.draftAssessmentId, auth.leadId);
    if (!entitlement) {
      return NextResponse.json({ error: "Draft assessment was not found." }, { status: 404 });
    }
    const gate = paidAssessmentGate(entitlement.paymentStatus);
    if (!gate.allow) {
      const accessToken = await signAccessToken("result_access", entitlement.assessmentId, { leadId: auth.leadId }, "7d");
      return NextResponse.json(
        {
          error:
            gate.code === "PAYMENT_PENDING"
              ? "Payment is still being verified. Detailed assessment stays locked until Cashfree confirms success."
              : "Unlock the Credit Profile Booster before completing the detailed assessment.",
          code: gate.code,
          paymentStatus: entitlement.paymentStatus,
          checkoutUrl: boosterCheckoutHref(entitlement.assessmentId, accessToken, USP_PRODUCT_SLUG),
        },
        { status: 402 },
      );
    }

    if (input.draftAssessmentId) {
      const draft = await prisma.assessment.findUnique({
        where: { id: input.draftAssessmentId },
        include: { score: true },
      });
      if (draft?.score && draft.status === "COMPLETED" && draft.leadId === auth.leadId) {
        const accessToken = await signAccessToken("result_access", draft.id, { leadId: auth.leadId }, "7d");
        const resultUrl = `${getPublicAppUrl()}/result/${draft.id}?token=${encodeURIComponent(accessToken)}`;
        return NextResponse.json({
          assessmentId: draft.id,
          accessToken,
          resultUrl,
          reused: true,
          indicative: {
            readinessScore: draft.score.readinessScore,
            readinessLabel: draft.score.readinessLabel,
            comfortableEmiMin: draft.score.comfortableEmiMin,
            comfortableEmiMax: draft.score.comfortableEmiMax,
            strengths: draft.score.strengths,
            improvements: draft.score.improvements,
            suitableCategories: draft.score.suitableCategories,
            disclaimer: "Indicative eligibility estimate, not a loan approval. Not a bureau score or lender approval.",
          },
        });
      }
    }

    // Deduplicate rapid re-submits with identical core profile for the same verified lead.
    const recent = input.draftAssessmentId
      ? null
      : await prisma.assessment.findFirst({
      where: {
        leadId: auth.leadId,
        status: "COMPLETED",
        createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
        loanAmount: input.loanAmount,
        loanPurpose: input.loanPurpose,
        employmentType: input.employmentType,
        monthlyIncomeRange: input.monthlyIncomeRange,
        creditRange: input.creditRange,
      },
      include: { score: true },
      orderBy: { createdAt: "desc" },
    });
    if (recent?.score) {
      const accessToken = await signAccessToken("result_access", recent.id, { leadId: auth.leadId }, "7d");
      const resultUrl = `${getPublicAppUrl()}/result/${recent.id}?token=${encodeURIComponent(accessToken)}`;
      return NextResponse.json({
        assessmentId: recent.id,
        accessToken,
        resultUrl,
        reused: true,
        indicative: {
          readinessScore: recent.score.readinessScore,
          readinessLabel: recent.score.readinessLabel,
          comfortableEmiMin: recent.score.comfortableEmiMin,
          comfortableEmiMax: recent.score.comfortableEmiMax,
          strengths: recent.score.strengths,
          improvements: recent.score.improvements,
          suitableCategories: recent.score.suitableCategories,
          disclaimer: "Indicative eligibility estimate, not a loan approval. Not a bureau score or lender approval.",
        },
      });
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
    const answers = Object.entries(input).filter(([key]) => !COMPLETE_ASSESSMENT_EXCLUDED_ANSWER_KEYS.includes(key as (typeof COMPLETE_ASSESSMENT_EXCLUDED_ANSWER_KEYS)[number]));

    console.info("assessment_submit_accepted", {
      leadId: auth.leadId,
      pan: maskPan(input.panNumber),
      loanAmount: input.loanAmount,
      employmentType: input.employmentType,
    });

    const scoreCreate = {
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
    };

    const assessment = await prisma.$transaction(async (tx) => {
      const paidOrder = input.draftAssessmentId
        ? await tx.order.findFirst({
            where: { assessmentId: input.draftAssessmentId, status: "PAID" },
            include: { product: true, reports: { take: 1 } },
          })
        : null;
      const lead = await tx.lead.update({
        where: { id: auth.leadId },
        data: {
          fullName: sanitizeText(input.fullName),
          state: sanitizeText(input.state),
          city: sanitizeText(input.city),
          source: input.source,
          utm: input.utm ?? Prisma.JsonNull,
          referredByCode: input.referralCode || undefined,
          stage: paidOrder ? "REPORT_PROCESSING" : "ASSESSMENT_COMPLETED",
        },
      });

      const coreAssessment = {
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
        status: "COMPLETED" as const,
      };

      let created: Assessment;
      if (input.draftAssessmentId) {
        created = await tx.assessment.update({
          where: { id: input.draftAssessmentId },
          data: coreAssessment,
        });
        await tx.assessmentAnswer.deleteMany({ where: { assessmentId: created.id } });
        await tx.assessmentAnswer.createMany({
          data: answers.map(([questionKey, value]) => ({
            assessmentId: created.id,
            questionKey,
            value: value as Prisma.InputJsonValue,
          })),
        });
        await tx.score.upsert({
          where: { assessmentId: created.id },
          create: { assessmentId: created.id, ...scoreCreate },
          update: scoreCreate,
        });
      } else {
        created = await tx.assessment.create({
          data: {
            leadId: lead.id,
            ...coreAssessment,
            answers: {
              create: answers.map(([questionKey, value]) => ({
                questionKey,
                value: value as Prisma.InputJsonValue,
              })),
            },
            score: { create: scoreCreate },
          },
        });
      }

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

      if (paidOrder?.reports[0]) {
        const completedAnswers = await tx.assessmentAnswer.findMany({ where: { assessmentId: created.id } });
        await tx.report.update({
          where: { id: paidOrder.reports[0].id },
          data: {
            snapshot: JSON.parse(
              JSON.stringify(
                buildPaymentReportSnapshot({
                  customerName: lead.fullName,
                  assessmentDate: created.completedAt,
                  loanType: created.loanType,
                  loanAmount: created.loanAmount?.toString() ?? null,
                  loanPurpose: created.loanPurpose,
                  employmentType: created.employmentType,
                  monthlyIncomeRange: created.monthlyIncomeRange,
                  existingEmi: created.existingEmi?.toString() ?? null,
                  creditRange: created.creditRange,
                  score: scoreCreate,
                  answers: completedAnswers,
                  productName: paidOrder.product.name,
                }),
              ),
            ),
          },
        });
      }

      return created;
    });

    const accessToken = await signAccessToken("result_access", assessment.id, { leadId: auth.leadId }, "7d");
    const resultUrl = `${getPublicAppUrl()}/result/${assessment.id}?token=${encodeURIComponent(accessToken)}`;
    sendWhatsAppTemplate(auth.leadId, "FREE_RESULT_READY", { link: resultUrl }).catch((error) =>
      console.error("whatsapp_result_failed", error instanceof Error ? error.message : "unknown"),
    );
    return NextResponse.json({
      assessmentId: assessment.id,
      accessToken,
      resultUrl,
      indicative: {
        readinessScore: result.readinessScore,
        readinessLabel: result.readinessLabel,
        comfortableEmiMin: result.comfortableEmiMin,
        comfortableEmiMax: result.comfortableEmiMax,
        strengths: result.strengths,
        improvements: result.improvements,
        suitableCategories: result.suitableCategories,
        monthlyIncomeMidpoint: capacity.monthlyIncomeMidpoint,
        estimatedFoirPercent: capacity.estimatedFoirPercent,
        loanToAnnualIncome: capacity.loanToAnnualIncome,
        disclaimer: "Indicative eligibility estimate, not a loan approval. Not a bureau score or lender approval.",
      },
    });
  } catch (error) {
    if (isAccessTokenError(error)) {
      console.warn("assessment_otp_token_rejected", { reason: error.reason });
      return NextResponse.json(
        {
          error: "Complete email OTP verification again.",
          code: "OTP_VERIFICATION_REQUIRED",
        },
        { status: 403 },
      );
    }

    const message = error instanceof Error ? error.message : "unknown";
    // Never log token material; message paths above exclude raw JWT/jose text by design.
    console.error("assessment_submit_failed", message === "INVALID_ORIGIN" ? message : "server_error");
    if (message === "INVALID_ORIGIN") {
      return NextResponse.json({ error: "Please reload this page on www.vploanconnect.in and try again." }, { status: 403 });
    }
    return NextResponse.json({ error: "We could not save your assessment. Please try again." }, { status: 500 });
  }
}
