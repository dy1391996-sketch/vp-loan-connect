import { getServerEnv } from "@/lib/env";
import { prisma } from "@/lib/db";
import { formatInr } from "@/lib/utils";
import type { PdfReportData } from "./pdf";

export async function getPdfReportData(reportId: string): Promise<PdfReportData | null> {
  const report = await prisma.report.findUnique({ where: { id: reportId }, include: { lead: true, assessment: { include: { score: true, answers: true } }, order: { include: { product: true } } } });
  if (!report?.assessment.score || report.order.status !== "PAID") return null;
  const score = report.assessment.score; const answers = Object.fromEntries(report.assessment.answers.map((item) => [item.questionKey, item.value]));
  const docs: Array<[string, string]> = [["panAvailable", "PAN"], ["aadhaarAvailable", "Aadhaar"], ["addressProofAvailable", "Address proof"], ["incomeProofAvailable", "Income proof"], ["bankStatementAvailable", "Recent bank statement"], ["businessRegistrationAvailable", "Business registration documents"]];
  const env = getServerEnv();
  return { type: report.type, reportReference: report.reportReference, customerName: report.lead.fullName, assessmentDate: (report.assessment.completedAt ?? report.assessment.createdAt).toLocaleDateString("en-IN"), generatedDate: new Date().toLocaleDateString("en-IN"), loanType: report.assessment.loanType ?? "General review", requestedAmount: formatInr(Number(report.assessment.loanAmount ?? 0)), employmentType: report.assessment.employmentType ?? "Not stated", incomeRange: report.assessment.monthlyIncomeRange ?? "Not stated", existingEmi: formatInr(Number(report.assessment.existingEmi ?? 0)), creditRange: report.assessment.creditRange ?? "Not known", readinessScore: score.readinessScore, readinessLabel: score.readinessLabel, emiBurden: score.emiBurden, documentationStatus: score.documentationStatus, creditHealthStatus: score.creditHealthStatus, comfortableEmi: `${formatInr(Number(score.comfortableEmiMin))} – ${formatInr(Number(score.comfortableEmiMax))}/month`, categories: asStrings(score.suitableCategories), strengths: asStrings(score.strengths), risks: asStrings(score.improvements), missingDocuments: docs.filter(([key]) => answers[key] !== true).map(([, label]) => label), supportEmail: env.SUPPORT_EMAIL, supportWhatsApp: env.SUPPORT_WHATSAPP, businessName: env.BUSINESS_NAME };
}
function asStrings(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
