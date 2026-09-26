import { pickAttribution, type AttributionMap } from "@/lib/attribution";
import { looksLikeDummyText, looksLikeFakePersonName, isImpossibleMobile } from "@/lib/domain/risk-signals";
import { normalizeIndianMobile } from "@/lib/utils";
import {
  ENQUIRY_FOLLOW_UP_CONSENT_TEXT,
  INDIAN_STATES_AND_UTS,
  LOAN_ASSISTANCE_CONSENT_VERSION,
  LOAN_ASSISTANCE_SOURCE,
  LOAN_ASSISTANCE_TYPES,
  VPLC_TEST_NAME_PREFIX,
  type LoanAssistanceType,
} from "@/lib/loan-assistance/constants";

const SUBMISSION_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NAME_PATTERN = /^[A-Za-z][A-Za-z .'-]{1,79}$/;

export type LoanAssistanceFieldErrors = Partial<
  Record<"fullName" | "mobile" | "city" | "state" | "loanType" | "followUpConsent" | "clientSubmissionKey", string>
>;

export type NormalizedLoanAssistanceEnquiry = {
  fullName: string;
  mobile: string;
  city: string;
  state: string;
  loanType: LoanAssistanceType;
  followUpConsent: true;
  consentText: string;
  consentVersion: string;
  clientSubmissionKey: string;
  utm: AttributionMap | null;
  isTest: boolean;
  source: string;
  pageUrl: string;
  fbp?: string;
  fbc?: string;
  marketingConsent: boolean;
};

export type LoanAssistanceValidationResult =
  | { ok: true; data: NormalizedLoanAssistanceEnquiry }
  | { ok: false; status: 400; error: string; fields?: LoanAssistanceFieldErrors };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function looksLikeContactValue(value: string): boolean {
  const compact = value.replace(/[\s-]/g, "");
  if (compact.includes("@")) return true;
  return /^(?:\+?91)?[6-9]\d{9}$/.test(compact);
}

export function sanitizeStoredAttribution(input: unknown): AttributionMap | null {
  const record = asRecord(input);
  if (!record) return null;
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string") flat[key] = value;
  }
  const picked = pickAttribution(flat);
  const clean: AttributionMap = {};
  for (const [key, value] of Object.entries(picked) as Array<[keyof AttributionMap, string | undefined]>) {
    if (!value || looksLikeContactValue(value)) continue;
    clean[key] = value;
  }
  return Object.keys(clean).length > 0 ? clean : null;
}

const PAGE_HOSTS = new Set(["www.vploanconnect.in", "vploanconnect.in", "localhost", "127.0.0.1"]);

export function sanitizeLoanAssistancePageUrl(raw: unknown): string {
  const fallback = "https://www.vploanconnect.in/loan-assistance";
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return fallback;
    if (!PAGE_HOSTS.has(url.hostname)) return fallback;
    if (url.pathname !== "/loan-assistance") return fallback;
    const clean = new URL(`${url.origin}/loan-assistance`);
    const attribution = sanitizeStoredAttribution(Object.fromEntries(url.searchParams.entries()));
    if (attribution) {
      for (const [key, value] of Object.entries(attribution)) {
        if (value) clean.searchParams.set(key, value);
      }
    }
    return clean.toString();
  } catch {
    return fallback;
  }
}

function optionalCookie(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 200) return undefined;
  if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) return undefined;
  return trimmed;
}

export function validateLoanAssistanceInput(raw: unknown): LoanAssistanceValidationResult {
  const body = asRecord(raw);
  if (!body) return { ok: false, status: 400, error: "Unable to submit this enquiry." };

  const honeypot = typeof body.companyUrl === "string" ? body.companyUrl.trim() : "";
  if (honeypot) return { ok: false, status: 400, error: "Unable to submit this enquiry." };

  const fields: LoanAssistanceFieldErrors = {};
  const rawName = typeof body.fullName === "string" ? body.fullName.trim().replace(/\s+/g, " ") : "";
  const isTest = rawName.startsWith(VPLC_TEST_NAME_PREFIX);
  const nameForCheck = isTest ? rawName.slice(VPLC_TEST_NAME_PREFIX.length).trim() : rawName;
  if (!NAME_PATTERN.test(nameForCheck) || looksLikeFakePersonName(nameForCheck)) {
    fields.fullName = "Enter your full name.";
  }

  let mobile = "";
  try {
    mobile = normalizeIndianMobile(typeof body.mobile === "string" ? body.mobile : "");
    const local = mobile.slice(3);
    if (isImpossibleMobile(local)) fields.mobile = "Enter a valid 10-digit Indian mobile number.";
  } catch {
    fields.mobile = "Enter a valid 10-digit Indian mobile number.";
  }

  const city = typeof body.city === "string" ? body.city.trim().replace(/\s+/g, " ") : "";
  if (city.length < 2 || city.length > 60 || looksLikeDummyText(city) || !/[A-Za-z]{2,}/.test(city)) {
    fields.city = "Enter your city.";
  }

  const state = typeof body.state === "string" ? body.state.trim() : "";
  if (!(INDIAN_STATES_AND_UTS as readonly string[]).includes(state)) {
    fields.state = "Select your state or union territory.";
  }

  const loanType = typeof body.loanType === "string" ? body.loanType.trim() : "";
  if (!(LOAN_ASSISTANCE_TYPES as readonly string[]).includes(loanType)) {
    fields.loanType = "Select a loan category.";
  }

  if (body.followUpConsent !== true) {
    fields.followUpConsent = "Consent is required before we can contact you about this enquiry.";
  }

  const clientSubmissionKey = typeof body.clientSubmissionKey === "string" ? body.clientSubmissionKey.trim() : "";
  if (!SUBMISSION_KEY.test(clientSubmissionKey)) {
    fields.clientSubmissionKey = "Reload this page and submit the form again.";
  }

  if (Object.keys(fields).length > 0) {
    return { ok: false, status: 400, error: "Check the highlighted fields and try again.", fields };
  }

  return {
    ok: true,
    data: {
      fullName: rawName.slice(0, 120),
      mobile,
      city: city.slice(0, 60),
      state,
      loanType: loanType as LoanAssistanceType,
      followUpConsent: true,
      consentText: ENQUIRY_FOLLOW_UP_CONSENT_TEXT,
      consentVersion: LOAN_ASSISTANCE_CONSENT_VERSION,
      clientSubmissionKey,
      utm: sanitizeStoredAttribution(body.utm),
      isTest,
      source: LOAN_ASSISTANCE_SOURCE,
      pageUrl: sanitizeLoanAssistancePageUrl(body.pageUrl),
      fbp: optionalCookie(body.fbp),
      fbc: optionalCookie(body.fbc),
      marketingConsent: body.marketingConsent === true,
    },
  };
}
