import {
  CREDIT_BAND_RANK,
  type CreditBand,
  type EmploymentType,
  type MatchEligibilityRules,
} from "@/lib/matching/catalog";

export type MatchProfile = {
  loanAmount: number;
  loanType: string;
  employmentType: EmploymentType | string;
  creditRange: CreditBand | string;
  existingEmi: number;
  monthlyIncome: number;
  readinessScore: number;
  emiBurden: string;
  documentationStatus: string;
  suitableCategories: string[];
  currentOverdue?: boolean;
};

export type MatchCandidateInput = {
  id: string;
  lenderName: string;
  productName: string;
  category: string;
  rules: MatchEligibilityRules;
};

export type MatchedOption = {
  id: string;
  name: string;
  productName: string;
  description: string;
  href: string;
  disclosure: string;
  category: string;
  fitScore: number;
  fitLabel: "Best profile fit" | "Strong match" | "Alternative option";
  reasons: string[];
};

function asCredit(value: string): CreditBand {
  if (value in CREDIT_BAND_RANK) return value as CreditBand;
  return "UNKNOWN";
}

function loanTypeCategory(loanType: string): string {
  switch (loanType) {
    case "BUSINESS":
      return "Business Loan";
    case "GOLD":
      return "Gold Loan";
    case "PROPERTY":
      return "Loan Against Property";
    case "CREDIT_HEALTH":
      return "Credit Health Support";
    default:
      return "Personal Loan";
  }
}

function parseRules(raw: unknown): MatchEligibilityRules | null {
  if (!raw || typeof raw !== "object") return null;
  const rules = raw as MatchEligibilityRules;
  if (!rules.applyUrl || !rules.description) return null;
  return rules;
}

export function isEligibleCandidate(profile: MatchProfile, candidate: MatchCandidateInput): boolean {
  const rules = candidate.rules;
  const credit = asCredit(String(profile.creditRange));
  const employment = String(profile.employmentType || "OTHER");
  const primaryCategory = loanTypeCategory(profile.loanType);
  const categories = new Set([primaryCategory, ...(profile.suitableCategories ?? [])]);

  if (rules.employmentTypes?.length && !rules.employmentTypes.includes(employment as EmploymentType)) {
    return false;
  }

  if (rules.minCreditBand && CREDIT_BAND_RANK[credit] < CREDIT_BAND_RANK[rules.minCreditBand]) {
    return false;
  }

  if (typeof rules.maxAmount === "number" && profile.loanAmount > rules.maxAmount * 1.25) {
    return false;
  }

  if (typeof rules.minAmount === "number" && profile.loanAmount > 0 && profile.loanAmount < rules.minAmount * 0.5) {
    return false;
  }

  if (rules.categories?.length) {
    const overlap = rules.categories.some((category) => categories.has(category) || category === primaryCategory);
    if (!overlap && candidate.category !== "Credit Health Support") return false;
  }

  if (profile.currentOverdue && rules.preferStrongCredit) return false;

  return true;
}

export function scoreCandidate(profile: MatchProfile, candidate: MatchCandidateInput): { score: number; reasons: string[] } {
  const rules = candidate.rules;
  const credit = asCredit(String(profile.creditRange));
  const employment = String(profile.employmentType || "OTHER");
  const reasons: string[] = [];
  let score = 35;

  if (!rules.employmentTypes?.length || rules.employmentTypes.includes(employment as EmploymentType)) {
    score += 20;
    reasons.push("Employment profile fits this option");
  }

  if (rules.minCreditBand) {
    const gap = CREDIT_BAND_RANK[credit] - CREDIT_BAND_RANK[rules.minCreditBand];
    if (gap >= 2) {
      score += 22;
      reasons.push("Credit band is comfortably above the typical entry level");
    } else if (gap >= 0) {
      score += 14;
      reasons.push("Credit band meets the typical entry level");
    }
  } else {
    score += 10;
  }

  if (rules.preferStrongCredit && ["700_749", "750_PLUS"].includes(credit)) {
    score += 12;
    reasons.push("Stronger credit profiles usually get better outcomes here");
  }

  if (rules.shortTermFriendly && profile.loanAmount > 0 && profile.loanAmount <= 100000) {
    score += 10;
    reasons.push("Amount range suits short-term / digital lenders");
  }

  if (typeof rules.maxAmount === "number" && profile.loanAmount > 0 && profile.loanAmount <= rules.maxAmount) {
    score += 8;
    reasons.push("Requested amount is within a practical online range");
  }

  if (profile.readinessScore >= 80) score += 8;
  else if (profile.readinessScore >= 65) score += 5;
  else if (profile.readinessScore < 45) score -= 8;

  if (profile.emiBurden === "Low") score += 6;
  else if (profile.emiBurden === "High" || profile.emiBurden === "Very high") score -= 6;

  if (profile.documentationStatus === "Strong") score += 5;
  else if (profile.documentationStatus === "Incomplete") score -= 4;

  if (candidate.category === "Credit Health Support" && ["BELOW_550", "550_599", "600_649", "UNKNOWN"].includes(credit)) {
    score += 28;
    reasons.push("Checking your official bureau report first is useful for this profile");
  }

  if (reasons.length === 0) reasons.push("General profile compatibility");

  return { score: Math.max(0, Math.min(100, score)), reasons: reasons.slice(0, 3) };
}

function fitLabel(score: number, index: number): MatchedOption["fitLabel"] {
  if (index === 0) return "Best profile fit";
  if (score >= 70) return "Strong match";
  return "Alternative option";
}

function toMatchedOption(profile: MatchProfile, candidate: MatchCandidateInput, index: number): MatchedOption {
  const { score, reasons } = scoreCandidate(profile, candidate);
  return {
    id: candidate.id,
    name: candidate.lenderName,
    productName: candidate.productName,
    description: candidate.rules.description,
    href: candidate.rules.applyUrl,
    disclosure: candidate.rules.disclosure || "Final eligibility is decided only by the regulated lender after verification.",
    category: candidate.category,
    fitScore: score,
    fitLabel: fitLabel(score, index),
    reasons,
  };
}

export function rankLoanMatches(profile: MatchProfile, candidates: MatchCandidateInput[], limit = 6): MatchedOption[] {
  return candidates
    .filter((candidate) => parseRules(candidate.rules) && isEligibleCandidate(profile, candidate))
    .map((candidate) => toMatchedOption(profile, candidate, 99))
    .sort((a, b) => b.fitScore - a.fitScore || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((option, index) => ({ ...option, fitLabel: fitLabel(option.fitScore, index) }));
}

/** Paid unlock: best-fit first, then remaining official platforms users can still open. */
export function bundlePaidConnectOptions(
  profile: MatchProfile,
  candidates: MatchCandidateInput[],
  matchedLimit = 8,
): { matched: MatchedOption[]; more: MatchedOption[] } {
  const matched = rankLoanMatches(profile, candidates, matchedLimit);
  const matchedIds = new Set(matched.map((item) => item.id));
  const more = candidates
    .filter((candidate) => parseRules(candidate.rules) && !matchedIds.has(candidate.id))
    .map((candidate) => toMatchedOption(profile, candidate, 99))
    .sort((a, b) => b.fitScore - a.fitScore || a.name.localeCompare(b.name))
    .map((option) => ({
      ...option,
      fitLabel: "Alternative option" as const,
      reasons: option.reasons.length ? option.reasons : ["Additional official platform you can review"],
    }));
  return { matched, more };
}

export function candidatesFromCatalog(
  catalog: Array<{
    displayName: string;
    productName: string;
    category: string;
    rules: MatchEligibilityRules;
  }>,
): MatchCandidateInput[] {
  return catalog.map((item, index) => ({
    id: `catalog-${index}-${item.displayName}`,
    lenderName: item.displayName,
    productName: item.productName,
    category: item.category,
    rules: item.rules,
  }));
}

export function parseProductRules(raw: unknown): MatchEligibilityRules | null {
  return parseRules(raw);
}
