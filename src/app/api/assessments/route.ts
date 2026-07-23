import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { assessmentSchema } from "@/lib/domain/assessment-schema";
import { calculateReadiness, incomeRangeMidpoints, type ScoreInput } from "@/lib/domain/scoring";
import { CONSENT_VERSION, MARKETING_CONSENT_TEXT, SERVICE_CONSENT_TEXT } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getPublicAppUrl, getServerEnv } from "@/lib/env";
import { sendWhatsAppTemplate } from "@/lib/providers/whatsapp";
import { assertSameOrigin, requestIp, sanitizeText } from "@/lib/security/request";
import { signAccessToken, verifyAccessToken } from "@/lib/security/tokens";
import { normalizeIndianMobile } from "@/lib/utils";
import { isValidReferral } from "@/lib/domain/referrals";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const parsed = assessmentSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Please review the highlighted assessment fields.", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const input = parsed.data;
    const mobile = normalizeIndianMobile(input.mobile);
    const token = await verifyAccessToken(input.otpVerificationToken, "otp_verified");
    if (token.sub !== mobile || typeof token.leadId !== "string") return NextResponse.json({ error: "Mobile verification does not match this assessment." }, { status: 403 });
    const scoreInput: ScoreInput = { ...input, monthlyIncomeRange: input.monthlyIncomeRange as keyof typeof incomeRangeMidpoints };
    const result = calculateReadiness(scoreInput);
    const env = getServerEnv();
    const userAgent = request.headers.get("user-agent")?.slice(0, 500);
    const ipAddress = env.STORE_CONSENT_IP ? requestIp(request) : undefined;
    const answers = Object.entries(input).filter(([key]) => !["otpVerificationToken", "serviceConsent", "marketingConsent", "fullName", "mobile", "state", "city", "loanAmount", "loanPurpose", "loanType", "source", "referralCode", "utm"].includes(key));

    const assessment = await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.update({ where: { id: token.leadId as string }, data: { fullName: sanitizeText(input.fullName), state: sanitizeText(input.state), city: sanitizeText(input.city), source: input.source, utm: input.utm ?? Prisma.JsonNull, referredByCode: input.referralCode || undefined, stage: "ASSESSMENT_COMPLETED" } });
      const created = await tx.assessment.create({ data: { leadId: lead.id, status: "COMPLETED", loanAmount: input.loanAmount, loanPurpose: sanitizeText(input.loanPurpose), loanType: input.loanType, employmentType: input.employmentType, monthlyIncomeRange: input.monthlyIncomeRange, monthlyIncome: incomeRangeMidpoints[input.monthlyIncomeRange], existingEmi: input.existingEmi, creditRange: input.creditRange, source: input.source, referralCode: input.referralCode || null, completionPercent: 100, completedAt: new Date(), answers: { create: answers.map(([questionKey, value]) => ({ questionKey, value: value as Prisma.InputJsonValue })) }, score: { create: { readinessScore: result.readinessScore, readinessLabel: result.readinessLabel, emiRatio: result.emiRatio, emiBurden: result.emiBurden, documentationStatus: result.documentationStatus, creditHealthStatus: result.creditHealthStatus, comfortableEmiMin: result.comfortableEmiMin, comfortableEmiMax: result.comfortableEmiMax, suitableCategories: result.suitableCategories, strengths: result.strengths, improvements: result.improvements, factorBreakdown: result.factorBreakdown as unknown as Prisma.InputJsonValue, engineVersion: result.engineVersion } } } });
      await tx.consentLog.createMany({ data: [
        { leadId: lead.id, consentType: "SERVICE", consentText: SERVICE_CONSENT_TEXT, consentVersion: CONSENT_VERSION, accepted: true, acceptedAt: new Date(), source: input.source, userAgent, ipAddress },
        { leadId: lead.id, consentType: "MARKETING", consentText: MARKETING_CONSENT_TEXT, consentVersion: CONSENT_VERSION, accepted: input.marketingConsent, acceptedAt: input.marketingConsent ? new Date() : null, source: input.source, userAgent, ipAddress },
      ] });

      if (input.referralCode) {
        const referrer = await tx.lead.findUnique({ where: { referralCode: input.referralCode } });
        if (referrer && isValidReferral({ referrerId: referrer.id, referredId: lead.id, referrerMobile: referrer.mobile, referredMobile: lead.mobile })) {
          await tx.referral.upsert({ where: { referredLeadId: lead.id }, update: {}, create: { referrerLeadId: referrer.id, referredLeadId: lead.id, referralCode: input.referralCode } });
        }
      }
      return created;
    });

    const accessToken = await signAccessToken("result_access", assessment.id, { leadId: token.leadId as string }, "7d");
    const resultUrl = `${getPublicAppUrl()}/result/${assessment.id}?token=${encodeURIComponent(accessToken)}`;
    sendWhatsAppTemplate(token.leadId as string, "FREE_RESULT_READY", { link: resultUrl }).catch((error) => console.error("whatsapp_result_failed", error instanceof Error ? error.message : "unknown"));
    return NextResponse.json({ assessmentId: assessment.id, accessToken, resultUrl });
  } catch (error) {
    console.error("assessment_submit_failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "We could not save your assessment. Please try again." }, { status: 500 });
  }
}
