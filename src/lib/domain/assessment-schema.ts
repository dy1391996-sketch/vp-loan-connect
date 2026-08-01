import { z } from "zod";
import { incomeRangeMidpoints } from "./scoring";

const yesNo = z.boolean();

export const assessmentSchema = z.object({
  otpVerificationToken: z.string().min(20),
  fullName: z.string().trim().min(2).max(100),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number."),
  email: z.string().trim().email().max(254),
  state: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  residentialAddress: z.string().trim().min(8).max(240),
  pinCode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit PIN code."),
  loanAmount: z.coerce.number().min(50000).max(1500000),
  loanPurpose: z.string().trim().min(2).max(120),
  loanType: z.enum(["PERSONAL", "BUSINESS", "MSME", "MUDRA_GUIDANCE", "GOLD", "PROPERTY", "CREDIT_HEALTH"]),
  employmentType: z.enum(["SALARIED", "SELF_EMPLOYED", "BUSINESS_OWNER", "FREELANCER", "OTHER"]),
  employerOrBusinessName: z.string().trim().min(2).max(160),
  officeAddress: z.string().trim().min(5).max(240),
  monthlyIncomeRange: z.enum(Object.keys(incomeRangeMidpoints) as [string, ...string[]]),
  annualIncome: z.coerce.number().min(0).max(1000000000),
  durationMonths: z.coerce.number().int().min(0).max(600),
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

export type AssessmentPayload = z.infer<typeof assessmentSchema>;
