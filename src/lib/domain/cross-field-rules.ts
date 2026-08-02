import { incomeRangeMidpoints } from "./scoring";

export type ConsistencyIssue = { path: string; message: string };

/** Deterministic cross-field checks — not a bureau or lender decision. */
export function evaluateIncomeLoanConsistency(input: {
  monthlyIncomeRange: string;
  existingEmi: number;
  loanAmount: number;
  durationMonths: number;
  employmentType: string;
  dateOfBirth?: string;
}): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const income = incomeRangeMidpoints[input.monthlyIncomeRange];
  if (!income) {
    issues.push({ path: "monthlyIncomeRange", message: "Choose a valid monthly income range." });
    return issues;
  }

  if (input.existingEmi < 0) {
    issues.push({ path: "existingEmi", message: "Existing EMI cannot be negative." });
  }
  if (input.existingEmi > income) {
    issues.push({
      path: "existingEmi",
      message: "Monthly EMI cannot exceed declared monthly income. Please correct EMI or income.",
    });
  }
  if (input.existingEmi > income * 0.7) {
    issues.push({
      path: "existingEmi",
      message: "Existing EMI is unusually high versus income. Please re-check both values.",
    });
  }

  const annual = income * 12;
  if (input.loanAmount > annual * 4) {
    issues.push({
      path: "loanAmount",
      message: "Requested loan amount looks inconsistent with declared income. Choose a lower amount or correct income.",
    });
  }

  // Annual mistakenly entered as monthly: midpoint for BELOW_15000 is 12500; if user picks 150000_PLUS with tiny loan ok.
  // Flag when income range bottom is still less than existing EMI * 1 (already covered).

  if (input.durationMonths < 0 || input.durationMonths > 480) {
    issues.push({ path: "durationMonths", message: "Employment/business duration looks impossible." });
  }
  if (input.durationMonths > 0 && input.durationMonths < 1 && ["SALARIED", "SELF_EMPLOYED", "BUSINESS_OWNER"].includes(input.employmentType)) {
    issues.push({ path: "durationMonths", message: "Employment duration must be at least 1 month." });
  }

  if (input.dateOfBirth) {
    const age = ageFromDob(input.dateOfBirth);
    if (age === null) {
      issues.push({ path: "dateOfBirth", message: "Enter a valid date of birth." });
    } else if (age < 21) {
      issues.push({ path: "dateOfBirth", message: "Applicant must be at least 21 years old for this product." });
    } else if (age > 65) {
      issues.push({ path: "dateOfBirth", message: "Applicant age exceeds the supported limit for this product (65)." });
    }
  }

  return issues;
}

export function ageFromDob(isoDate: string, now = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const [y, m, d] = isoDate.split("-").map(Number);
  const dob = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(dob.getTime())) return null;
  if (dob.getUTCFullYear() !== y || dob.getUTCMonth() !== m - 1 || dob.getUTCDate() !== d) return null;
  if (dob.getTime() > now.getTime()) return null;
  let age = now.getUTCFullYear() - y;
  const monthDiff = now.getUTCMonth() - (m - 1);
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < d)) age -= 1;
  if (age < 0 || age > 120) return null;
  return age;
}

export function estimateIndicativeCapacity(input: {
  monthlyIncomeRange: string;
  existingEmi: number;
  loanAmount: number;
}) {
  const income = incomeRangeMidpoints[input.monthlyIncomeRange] ?? 0;
  const remaining = Math.max(0, income * 0.4 - input.existingEmi);
  const foir = income > 0 ? Math.round(((input.existingEmi / income) * 1000) / 10) : 0;
  return {
    monthlyIncomeMidpoint: income,
    estimatedFoirPercent: foir,
    comfortableEmiMax: Math.round(Math.max(0, Math.min(income * 0.25, remaining)) / 100) * 100,
    loanToAnnualIncome: income > 0 ? Math.round((input.loanAmount / (income * 12)) * 10) / 10 : null,
  };
}
