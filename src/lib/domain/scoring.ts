export const SCORE_ENGINE_VERSION = "v1.0.0";

export const incomeRangeMidpoints: Record<string, number> = {
  "BELOW_15000": 12500,
  "15000_24999": 20000,
  "25000_39999": 32500,
  "40000_59999": 50000,
  "60000_99999": 80000,
  "100000_149999": 125000,
  "150000_PLUS": 175000,
};

export type ScoreInput = {
  loanAmount: number;
  loanType: string;
  employmentType: "SALARIED" | "SELF_EMPLOYED" | "BUSINESS_OWNER" | "FREELANCER" | "OTHER";
  monthlyIncomeRange: keyof typeof incomeRangeMidpoints;
  durationMonths: number;
  salaryBankCredit: boolean;
  itrAvailable: boolean;
  gstAvailable: boolean;
  udyamAvailable: boolean;
  sixMonthBankStatement: boolean;
  existingEmi: number;
  activeLoans: number;
  cardOutstanding: number;
  currentOverdue: boolean;
  settledOrWrittenOff: boolean;
  creditRange: "BELOW_550" | "550_599" | "600_649" | "650_699" | "700_749" | "750_PLUS" | "UNKNOWN";
  panAvailable: boolean;
  aadhaarAvailable: boolean;
  addressProofAvailable: boolean;
  incomeProofAvailable: boolean;
  bankStatementAvailable: boolean;
  businessRegistrationAvailable: boolean;
  securedAssetAvailable: boolean;
};

export type ScoreFactor = { key: string; label: string; score: number; max: number; reason: string };

export type ScoreResult = {
  readinessScore: number;
  readinessLabel: "Strong readiness" | "Moderate readiness" | "Improvement required" | "High rejection risk";
  emiRatio: number;
  emiBurden: "Low" | "Moderate" | "High" | "Very high";
  documentationStatus: "Strong" | "Partial" | "Incomplete";
  creditHealthStatus: "Healthy" | "Review suggested" | "Improvement required" | "High risk";
  comfortableEmiMin: number;
  comfortableEmiMax: number;
  suitableCategories: string[];
  strengths: string[];
  improvements: string[];
  factorBreakdown: ScoreFactor[];
  engineVersion: string;
};

export function calculateReadiness(input: ScoreInput): ScoreResult {
  const income = incomeRangeMidpoints[input.monthlyIncomeRange];
  if (!income) throw new Error("Unsupported monthly income range.");
  const emiRatio = (input.existingEmi / income) * 100;
  const factors: ScoreFactor[] = [];

  const stableEmployment = ["SALARIED", "SELF_EMPLOYED", "BUSINESS_OWNER"].includes(input.employmentType);
  const stabilityScore = Math.min(15, (stableEmployment ? 8 : 5) + (input.salaryBankCredit ? 3 : 0) + (input.durationMonths >= 24 ? 4 : input.durationMonths >= 12 ? 2 : 0));
  factors.push({ key: "income_stability", label: "Income stability", score: stabilityScore, max: 15, reason: `Employment profile and ${input.durationMonths} months of continuity` });

  const emiScore = emiRatio <= 20 ? 20 : emiRatio <= 35 ? 16 : emiRatio <= 45 ? 10 : emiRatio <= 55 ? 5 : 0;
  factors.push({ key: "emi_capacity", label: "EMI capacity", score: emiScore, max: 20, reason: `${emiRatio.toFixed(1)}% current EMI-to-income ratio` });

  const creditScores: Record<ScoreInput["creditRange"], number> = {
    BELOW_550: 2,
    "550_599": 5,
    "600_649": 9,
    "650_699": 13,
    "700_749": 17,
    "750_PLUS": 20,
    UNKNOWN: 10,
  };
  factors.push({ key: "credit_health", label: "Credit profile", score: creditScores[input.creditRange], max: 20, reason: creditRangeLabel(input.creditRange) });

  const historyScore = input.currentOverdue ? 0 : input.settledOrWrittenOff ? 3 : 10;
  factors.push({ key: "repayment_history", label: "Repayment history", score: historyScore, max: 10, reason: input.currentOverdue ? "Current overdue reported" : input.settledOrWrittenOff ? "Settled or written-off history reported" : "No adverse history reported" });

  const coreDocuments = [input.panAvailable, input.aadhaarAvailable, input.addressProofAvailable, input.incomeProofAvailable, input.bankStatementAvailable];
  const docCount = coreDocuments.filter(Boolean).length;
  const businessDocBonus = ["SELF_EMPLOYED", "BUSINESS_OWNER"].includes(input.employmentType) && (input.itrAvailable || input.gstAvailable || input.udyamAvailable) ? 2 : 0;
  const documentsScore = Math.min(15, docCount * 2.6 + businessDocBonus + (input.sixMonthBankStatement ? 1 : 0));
  factors.push({ key: "documents", label: "Document readiness", score: Math.round(documentsScore), max: 15, reason: `${docCount} of 5 core documents available` });

  const vintageScore = input.durationMonths >= 24 ? 5 : input.durationMonths >= 12 ? 3 : input.durationMonths >= 6 ? 2 : 0;
  factors.push({ key: "vintage", label: "Employment/business vintage", score: vintageScore, max: 5, reason: `${input.durationMonths} months reported` });

  const annualIncome = income * 12;
  const requestedRatio = input.loanAmount / annualIncome;
  const amountFitScore = requestedRatio <= 0.5 ? 10 : requestedRatio <= 1 ? 8 : requestedRatio <= 2 ? 5 : requestedRatio <= 3 ? 2 : 0;
  factors.push({ key: "amount_fit", label: "Requested amount fit", score: amountFitScore, max: 10, reason: `${requestedRatio.toFixed(1)}× indicative annual income` });

  const assetScore = input.securedAssetAvailable ? 5 : 2;
  factors.push({ key: "security_options", label: "Security options", score: assetScore, max: 5, reason: input.securedAssetAvailable ? "Secured asset option reported" : "No secured asset option reported" });

  const readinessScore = Math.max(0, Math.min(100, factors.reduce((sum, factor) => sum + factor.score, 0)));
  const readinessLabel = readinessScore >= 80 ? "Strong readiness" : readinessScore >= 65 ? "Moderate readiness" : readinessScore >= 45 ? "Improvement required" : "High rejection risk";
  const emiBurden = emiRatio <= 20 ? "Low" : emiRatio <= 35 ? "Moderate" : emiRatio <= 50 ? "High" : "Very high";
  const documentationStatus = docCount >= 5 ? "Strong" : docCount >= 3 ? "Partial" : "Incomplete";
  const creditHealthStatus = creditStatus(input);
  const remainingCapacity = Math.max(0, income * 0.4 - input.existingEmi);
  const comfortableEmiMin = roundToHundred(Math.max(0, Math.min(income * 0.15, remainingCapacity * 0.6)));
  const comfortableEmiMax = roundToHundred(Math.max(0, Math.min(income * 0.25, remainingCapacity)));

  return {
    readinessScore,
    readinessLabel,
    emiRatio: Math.round(emiRatio * 10) / 10,
    emiBurden,
    documentationStatus,
    creditHealthStatus,
    comfortableEmiMin,
    comfortableEmiMax,
    suitableCategories: categories(input),
    strengths: strengths(input, emiRatio, docCount),
    improvements: improvements(input, emiRatio, docCount),
    factorBreakdown: factors,
    engineVersion: SCORE_ENGINE_VERSION,
  };
}

function creditStatus(input: ScoreInput): ScoreResult["creditHealthStatus"] {
  if (input.currentOverdue || input.creditRange === "BELOW_550") return "High risk";
  if (input.settledOrWrittenOff || ["550_599", "600_649"].includes(input.creditRange)) return "Improvement required";
  if (input.creditRange === "UNKNOWN" || input.creditRange === "650_699") return "Review suggested";
  return "Healthy";
}

function categories(input: ScoreInput) {
  const result = new Set<string>();
  if (input.employmentType === "SALARIED") result.add("Personal Loan");
  if (["SELF_EMPLOYED", "BUSINESS_OWNER", "FREELANCER"].includes(input.employmentType)) {
    result.add("Business Loan");
    result.add("MSME Loan");
    result.add("Mudra Loan Guidance");
  }
  if (input.securedAssetAvailable) {
    result.add("Gold Loan");
    result.add("Loan Against Property");
  }
  if (input.currentOverdue || input.settledOrWrittenOff || ["BELOW_550", "550_599", "600_649"].includes(input.creditRange)) result.add("Credit Health Support");
  if (result.size === 0) result.add(input.loanType || "General loan options review");
  return [...result];
}

function strengths(input: ScoreInput, emiRatio: number, docCount: number) {
  const items: string[] = [];
  if (emiRatio <= 35) items.push("Current EMI burden appears manageable against the stated income range.");
  if (["700_749", "750_PLUS"].includes(input.creditRange)) items.push("Reported credit-score range is generally supportive of application readiness.");
  if (!input.currentOverdue && !input.settledOrWrittenOff) items.push("No current overdue or settled/written-off account was reported.");
  if (docCount >= 4) items.push("Most core identity, address and income documents are available.");
  if (input.durationMonths >= 24) items.push("Employment or business continuity is a positive readiness factor.");
  return items.length ? items : ["Completing this assessment gives you a clear starting point for preparation."];
}

function improvements(input: ScoreInput, emiRatio: number, docCount: number) {
  const items: string[] = [];
  if (emiRatio > 35) items.push("Reduce or consolidate existing monthly obligations before a new application where possible.");
  if (input.currentOverdue) items.push("Bring current overdue accounts up to date and retain payment confirmations.");
  if (input.settledOrWrittenOff) items.push("Review settled or written-off reporting and obtain current statements from the relevant institution.");
  if (["BELOW_550", "550_599", "600_649"].includes(input.creditRange)) items.push("Review repayment history, utilization and enquiries before submitting multiple applications.");
  if (docCount < 4) items.push("Prepare missing identity, address, income and recent bank-statement documents.");
  if (input.durationMonths < 12) items.push("A longer employment or business track record may improve the strength of the profile.");
  return items.length ? items : ["Verify all application details and avoid applying simultaneously with multiple lenders."];
}

function creditRangeLabel(value: ScoreInput["creditRange"]) {
  const labels: Record<ScoreInput["creditRange"], string> = {
    BELOW_550: "Below 550 (self-reported)",
    "550_599": "550–599 (self-reported)",
    "600_649": "600–649 (self-reported)",
    "650_699": "650–699 (self-reported)",
    "700_749": "700–749 (self-reported)",
    "750_PLUS": "750+ (self-reported)",
    UNKNOWN: "Score not known",
  };
  return labels[value];
}

function roundToHundred(value: number) {
  return Math.round(value / 100) * 100;
}
