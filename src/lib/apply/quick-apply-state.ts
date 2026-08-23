import type { AttributionMap } from "@/lib/attribution";
import type { incomeRangeMidpoints } from "@/lib/domain/scoring";

export const QUICK_APPLY_STEPS = 6;
export const QUICK_APPLY_DRAFT_KEY = "vplc_quick_apply_draft_v3";
export const QUICK_APPLY_RESULT_KEY = "vplc_quick_apply_result_v2";
export const MIN_LOAN_AMOUNT = 10_000;
export const MAX_LOAN_AMOUNT = 1_000_000;

export const QUICK_APPLY_STEP_LABELS = [
  "Start your profile",
  "Email verification",
  "Credit Profile Booster",
  "Profile details",
  "PAN & consent",
  "Loan options",
] as const;

export const QUICK_AMOUNTS = [25_000, 50_000, 100_000, 200_000, 500_000] as const;

export const LOAN_PURPOSES = [
  { id: "medical", label: "Medical emergency", value: "Medical emergency" },
  { id: "personal", label: "Personal expenses", value: "Personal expenses" },
  { id: "debt", label: "Debt consolidation", value: "Debt consolidation" },
  { id: "education", label: "Education", value: "Education expense" },
  { id: "wedding", label: "Wedding", value: "Wedding" },
  { id: "travel", label: "Travel", value: "Travel" },
  { id: "home", label: "Home improvement", value: "Home improvement" },
  { id: "business", label: "Business", value: "Business working capital" },
  { id: "other", label: "Other", value: "Other personal need" },
] as const;

export type EmploymentUiType = "SALARIED" | "SELF_EMPLOYED" | "BUSINESS_OWNER" | "PROFESSIONAL" | "OTHER";

export const EMPLOYMENT_OPTIONS: Array<{ id: EmploymentUiType; label: string; api: "SALARIED" | "SELF_EMPLOYED" | "BUSINESS_OWNER" | "FREELANCER" | "OTHER" }> = [
  { id: "SALARIED", label: "Salaried", api: "SALARIED" },
  { id: "SELF_EMPLOYED", label: "Self-employed", api: "SELF_EMPLOYED" },
  { id: "BUSINESS_OWNER", label: "Business owner", api: "BUSINESS_OWNER" },
  { id: "PROFESSIONAL", label: "Professional", api: "FREELANCER" },
  { id: "OTHER", label: "Other", api: "OTHER" },
];

export const CREDIT_OPTIONS = [
  { id: "750_PLUS", label: "750+" },
  { id: "700_749", label: "700–749" },
  { id: "650_699", label: "650–699" },
  { id: "600_649", label: "600–649" },
  { id: "BELOW_550", label: "Below 600" },
  { id: "UNKNOWN", label: "Don’t know" },
] as const;

export type ResidenceType = "OWNED" | "RENTED" | "PARENTAL" | "OTHER";

export type QuickApplyFormState = {
  loanAmount: number;
  loanPurpose: string;
  fullName: string;
  email: string;
  mobile: string;
  dateOfBirth: string;
  pinCode: string;
  employmentUi: EmploymentUiType | "";
  monthlyIncome: string;
  employerOrBusinessName: string;
  durationMonths: string;
  salaryCreditMode: "bank" | "cash" | "cheque" | "";
  salaryDate: string;
  existingEmi: string;
  activeLoans: string;
  cardOutstanding: string;
  currentOverdue: boolean | null;
  creditRange: (typeof CREDIT_OPTIONS)[number]["id"] | "";
  panNumber: string;
  residentialAddress: string;
  city: string;
  state: string;
  addressPinCode: string;
  residenceType: ResidenceType | "";
  yearsAtAddress: string;
  serviceConsent: boolean;
  marketingConsent: boolean;
};

export type QuickApplyDraft = {
  step: number;
  form: QuickApplyFormState;
  otpVerified: boolean;
  updatedAt: number;
};

export const defaultQuickApplyForm = (): QuickApplyFormState => ({
  loanAmount: 50_000,
  loanPurpose: "",
  fullName: "",
  email: "",
  mobile: "",
  dateOfBirth: "",
  pinCode: "",
  employmentUi: "",
  monthlyIncome: "",
  employerOrBusinessName: "",
  durationMonths: "",
  salaryCreditMode: "",
  salaryDate: "",
  existingEmi: "",
  activeLoans: "",
  cardOutstanding: "",
  currentOverdue: null,
  creditRange: "",
  panNumber: "",
  residentialAddress: "",
  city: "",
  state: "",
  addressPinCode: "",
  residenceType: "",
  yearsAtAddress: "",
  serviceConsent: false,
  marketingConsent: false,
});

export function formatInrDigits(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  return new Intl.NumberFormat("en-IN").format(Math.round(value));
}

export function parseInrDigits(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return 0;
  return Number(digits);
}

export function mapIncomeToRange(monthlyIncome: number): keyof typeof incomeRangeMidpoints {
  if (monthlyIncome < 15_000) return "BELOW_15000";
  if (monthlyIncome < 25_000) return "15000_24999";
  if (monthlyIncome < 40_000) return "25000_39999";
  if (monthlyIncome < 60_000) return "40000_59999";
  if (monthlyIncome < 100_000) return "60000_99999";
  if (monthlyIncome < 150_000) return "100000_149999";
  return "150000_PLUS";
}

export function mapEmploymentApi(ui: EmploymentUiType | "") {
  const found = EMPLOYMENT_OPTIONS.find((item) => item.id === ui);
  return found?.api ?? "OTHER";
}

export function loanTypeFromPurpose(purpose: string): "PERSONAL" | "BUSINESS" {
  return purpose === "Business working capital" ? "BUSINESS" : "PERSONAL";
}

export type DraftSafeForm = Omit<QuickApplyFormState, "panNumber"> & { panNumber?: string };

/** Persist non-sensitive progress. OTP tokens and full PAN are excluded. */
export function toPersistedDraft(step: number, form: QuickApplyFormState, otpVerified: boolean): QuickApplyDraft {
  return {
    step,
    form: { ...form, panNumber: "" },
    otpVerified,
    updatedAt: Date.now(),
  };
}

export function readDraft(): QuickApplyDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(QUICK_APPLY_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuickApplyDraft;
    if (!parsed || typeof parsed !== "object" || !parsed.form) return null;
    // Resume drafts for 7 days.
    if (Date.now() - (parsed.updatedAt || 0) > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(QUICK_APPLY_DRAFT_KEY);
      return null;
    }
    return {
      step: Math.min(QUICK_APPLY_STEPS, Math.max(1, Number(parsed.step) || 1)),
      form: { ...defaultQuickApplyForm(), ...parsed.form, panNumber: "", serviceConsent: false, marketingConsent: false },
      // Never trust local otpVerified alone for submit — still need token in memory.
      otpVerified: false,
      updatedAt: parsed.updatedAt || Date.now(),
    };
  } catch {
    return null;
  }
}

export function writeDraft(step: number, form: QuickApplyFormState, otpVerified: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(QUICK_APPLY_DRAFT_KEY, JSON.stringify(toPersistedDraft(step, form, otpVerified)));
  } catch {
    /* ignore quota */
  }
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(QUICK_APPLY_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return email;
  if (user.length <= 2) return `${user[0] ?? "*"}***@${domain}`;
  return `${user.slice(0, 2)}***${user.slice(-1)}@${domain}`;
}

export type AttributionForSubmit = AttributionMap;

export type QuickApplyResultSnapshot = {
  assessmentId: string;
  accessToken: string;
  indicative?: {
    readinessScore: number;
    readinessLabel: string;
    comfortableEmiMin?: number;
    comfortableEmiMax?: number;
    strengths?: string[];
    improvements?: string[];
    suitableCategories?: string[];
    disclaimer?: string;
  };
  loanAmount: number;
  paid?: boolean;
  status?: "STARTED" | "COMPLETED";
};

export function readResultSnapshot(): QuickApplyResultSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(QUICK_APPLY_RESULT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuickApplyResultSnapshot;
    if (!parsed?.assessmentId || !parsed?.accessToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeResultSnapshot(snapshot: QuickApplyResultSnapshot) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(QUICK_APPLY_RESULT_KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore quota */
  }
}

export function clearResultSnapshot() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(QUICK_APPLY_RESULT_KEY);
  } catch {
    /* ignore */
  }
}
