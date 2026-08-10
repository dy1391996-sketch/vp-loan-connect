import { z } from "zod";
import { evaluateIncomeLoanConsistency } from "./cross-field-rules";
import { isIndividualPan, isValidPanFormat, normalizePan } from "./identity";
import { isDisposableEmailDomain, isImpossibleMobile, looksLikeFakePersonName, looksLikeWeakAddress, normalizeEmail } from "./risk-signals";
import { incomeRangeMidpoints } from "./scoring";

const yesNo = z.boolean();

const baseAssessmentSchema = z.object({
  otpVerificationToken: z.string({ required_error: "Complete email OTP verification first." }).min(20, "Complete email OTP verification first."),
  fullName: z
    .string()
    .trim()
    .min(2, "Enter your full name as on PAN.")
    .max(100)
    .refine((value) => !looksLikeFakePersonName(value), "Enter a real full name (not a test/dummy value)."),
  mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number.")
    .refine((value) => !isImpossibleMobile(value), "Unable to validate this mobile number. Use your real mobile number."),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .max(254)
    .transform(normalizeEmail)
    .refine((value) => !isDisposableEmailDomain(value), "Unable to validate this email domain. Use a permanent email address."),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date of birth."),
  state: z.string().trim().min(2, "Enter your state.").max(80),
  city: z.string().trim().min(2, "Enter your city.").max(80),
  residentialAddress: z
    .string()
    .trim()
    .min(12, "Enter a complete residential address (house/street/locality).")
    .max(240)
    .refine((value) => !looksLikeWeakAddress(value), "Address looks incomplete or invalid. Add house/street/locality details."),
  pinCode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit PIN code."),
  residenceType: z.enum(["OWNED", "RENTED", "PARENTAL", "OTHER"]).default("OTHER"),
  monthsAtAddress: z.coerce.number().int().min(0).max(600).default(0),
  loanAmount: z.coerce.number().min(10000, "Minimum loan amount is ₹10,000.").max(1000000, "Maximum loan amount is ₹10,00,000."),
  loanPurpose: z.string().trim().min(2).max(120),
  loanType: z.enum(["PERSONAL", "BUSINESS", "MSME", "MUDRA_GUIDANCE", "GOLD", "PROPERTY", "CREDIT_HEALTH"]),
  employmentType: z.enum(["SALARIED", "SELF_EMPLOYED", "BUSINESS_OWNER", "FREELANCER", "OTHER"]),
  employerOrBusinessName: z
    .string()
    .trim()
    .min(2, "Enter employer or business name.")
    .max(160)
    .refine((value) => !looksLikeFakePersonName(value), "Enter a meaningful employer/business name."),
  officeAddress: z.string().trim().min(5).max(240),
  monthlyIncomeRange: z.enum(Object.keys(incomeRangeMidpoints) as [string, ...string[]]),
  annualIncome: z.coerce.number().min(0).max(1000000000),
  durationMonths: z.coerce.number().int().min(0, "Duration cannot be negative.").max(480, "Duration looks impossible."),
  salaryBankCredit: yesNo,
  itrAvailable: yesNo,
  gstAvailable: yesNo,
  udyamAvailable: yesNo,
  sixMonthBankStatement: yesNo,
  existingEmi: z.coerce.number().min(0).max(10000000),
  activeLoans: z.coerce.number().int().min(0).max(100),
  cardOutstanding: z.coerce.number().min(0).max(10000000),
  currentOverdue: yesNo,
  settledOrWrittenOff: yesNo,
  creditRange: z.enum(["BELOW_550", "550_599", "600_649", "650_699", "700_749", "750_PLUS", "UNKNOWN"]),
  panNumber: z
    .string()
    .trim()
    .transform(normalizePan)
    .refine((value) => isValidPanFormat(value), "Enter a valid 10-character PAN (e.g. ABCDE1234F).")
    .refine((value) => isIndividualPan(value), "Use an individual PAN (4th character must be P) for this personal profile."),
  panFormatValidated: z.boolean().optional(),
  panVerificationStatus: z
    .enum([
      "not_verified",
      "verification_pending",
      "verified_authorised_provider",
      "verification_failed",
      "name_mismatch",
      "provider_unavailable",
    ])
    .default("not_verified"),
  panAvailable: yesNo,
  aadhaarAvailable: yesNo,
  addressProofAvailable: yesNo,
  incomeProofAvailable: yesNo,
  bankStatementAvailable: yesNo,
  businessRegistrationAvailable: yesNo,
  securedAssetAvailable: yesNo,
  serviceConsent: z.literal(true, { errorMap: () => ({ message: "Service consent is required." }) }),
  marketingConsent: z.boolean(),
  source: z.string().trim().max(120).default("direct"),
  referralCode: z.string().trim().max(20).optional().or(z.literal("")),
  utm: z.record(z.string().max(200)).optional(),
});

export const assessmentSchema = baseAssessmentSchema.superRefine((data, ctx) => {
  if (data.panVerificationStatus === "verified_authorised_provider" && data.panFormatValidated !== true) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["panVerificationStatus"],
      message: "PAN cannot be marked verified without format validation and an authorised provider.",
    });
  }

  // Client must never claim authorised verification without a provider (format-only stack).
  if (data.panVerificationStatus === "verified_authorised_provider") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["panVerificationStatus"],
      message: "Authorised PAN verification is not connected. Format validation only.",
    });
  }

  for (const issue of evaluateIncomeLoanConsistency({
    monthlyIncomeRange: data.monthlyIncomeRange,
    existingEmi: data.existingEmi,
    loanAmount: data.loanAmount,
    durationMonths: data.durationMonths,
    employmentType: data.employmentType,
    dateOfBirth: data.dateOfBirth || undefined,
  })) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [issue.path],
      message: issue.message,
    });
  }

  if (data.monthsAtAddress > 600) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["monthsAtAddress"], message: "Months at address looks impossible." });
  }
});

export type AssessmentPayload = z.infer<typeof assessmentSchema>;

export function formatAssessmentFieldErrors(error: z.ZodError): Record<string, string[]> {
  return error.flatten().fieldErrors as Record<string, string[]>;
}
