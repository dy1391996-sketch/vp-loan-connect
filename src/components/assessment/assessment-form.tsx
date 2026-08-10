"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import {
  MARKETING_CONSENT_TEXT,
  PAYMENT_DESCRIPTION,
  SERVICE_CONSENT_TEXT,
  USP_PRICE_LABEL,
  USP_PRODUCT_NAME,
  USP_TOTAL_WITH_GST_LABEL,
} from "@/lib/constants";
import { trackEvent } from "@/lib/analytics-client";
import { captureAttributionFromSearch, getAttributionPayload } from "@/lib/attribution";
import { ageFromDob, evaluateIncomeLoanConsistency } from "@/lib/domain/cross-field-rules";
import { isIndividualPan, isValidPanFormat, maskPan, normalizePan } from "@/lib/domain/identity";
import { isImpossibleMobile, looksLikeFakePersonName, looksLikeWeakAddress } from "@/lib/domain/risk-signals";
import { incomeRangeMidpoints } from "@/lib/domain/scoring";
import { getPanProvider } from "@/lib/providers/pan";
import {
  prepareMsg91EmailOtp,
  resetMsg91EmailOtpClient,
  retryMsg91EmailOtp,
  sendMsg91EmailOtp,
  verifyMsg91EmailOtp,
} from "@/lib/apply/msg91-email-otp";
import { cn } from "@/lib/utils";

type ResidenceType = "OWNED" | "RENTED" | "PARENTAL" | "OTHER";

type FormState = {
  fullName: string;
  mobile: string;
  email: string;
  panNumber: string;
  dateOfBirth: string;
  state: string;
  city: string;
  residentialAddress: string;
  pinCode: string;
  residenceType: ResidenceType | "";
  monthsAtAddress: string;
  loanAmount: string;
  loanPurpose: string;
  loanType: string;
  employmentType: string;
  employerOrBusinessName: string;
  monthlyIncomeRange: string;
  existingEmi: string;
  durationMonths: string;
  creditRange: string;
  aadhaarAvailable: boolean;
  addressProofAvailable: boolean;
  incomeProofAvailable: boolean;
  bankStatementAvailable: boolean;
  sixMonthBankStatement: boolean;
  currentOverdue: boolean;
  settledOrWrittenOff: boolean;
  serviceConsent: boolean;
  marketingConsent: boolean;
};

const MSG91_WIDGET_ID = process.env.NEXT_PUBLIC_MSG91_WIDGET_ID ?? "";
const MSG91_WIDGET_TOKEN = process.env.NEXT_PUBLIC_MSG91_WIDGET_TOKEN ?? "";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STEPS = [
  { id: 1, label: "Verify" },
  { id: 2, label: "Eligibility" },
  { id: 3, label: "Address" },
  { id: 4, label: "Unlock" },
] as const;

const initialState: FormState = {
  fullName: "",
  mobile: "",
  email: "",
  panNumber: "",
  dateOfBirth: "",
  state: "",
  city: "",
  residentialAddress: "",
  pinCode: "",
  residenceType: "",
  monthsAtAddress: "",
  loanAmount: "100000",
  loanPurpose: "Other personal need",
  loanType: "PERSONAL",
  employmentType: "",
  employerOrBusinessName: "",
  monthlyIncomeRange: "",
  existingEmi: "",
  durationMonths: "",
  creditRange: "UNKNOWN",
  aadhaarAvailable: false,
  addressProofAvailable: false,
  incomeProofAvailable: false,
  bankStatementAvailable: false,
  sixMonthBankStatement: false,
  currentOverdue: false,
  settledOrWrittenOff: false,
  serviceConsent: false,
  marketingConsent: false,
};

function firstFieldError(fields: unknown): string {
  if (!fields || typeof fields !== "object") return "";
  for (const value of Object.values(fields as Record<string, unknown>)) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value)) {
      const message = value.find((item) => typeof item === "string" && item.trim());
      if (typeof message === "string") return message.trim();
    }
  }
  return "";
}

export function AssessmentForm() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initialState);
  const [otpStarted, setOtpStarted] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpToken, setOtpToken] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpReqId, setOtpReqId] = useState("");
  const [otpReady, setOtpReady] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [pinLookupBusy, setPinLookupBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    trackEvent("assessment_started");
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  useEffect(() => {
    captureAttributionFromSearch(searchParams);
    const amount = searchParams.get("amount") || searchParams.get("loanAmount");
    const loanType = searchParams.get("loanType") || searchParams.get("type");
    const purpose = searchParams.get("purpose") || searchParams.get("loanPurpose");

    setForm((current) => {
      const next = { ...current };
      let changed = false;
      if (amount && /^\d+$/.test(amount)) {
        next.loanAmount = String(Math.min(1000000, Math.max(10000, Number(amount))));
        changed = true;
      }
      if (loanType) {
        const normalized = loanType.trim().toUpperCase();
        const allowed = ["PERSONAL", "BUSINESS", "GOLD", "PROPERTY", "CREDIT_HEALTH"];
        if (allowed.includes(normalized)) {
          next.loanType = normalized;
          changed = true;
        }
      }
      if (purpose) {
        next.loanPurpose = purpose.slice(0, 120);
        changed = true;
      }
      return changed ? next : current;
    });
  }, [searchParams]);

  const attribution = useMemo(() => getAttributionPayload(searchParams), [searchParams]);
  const source = attribution.utm_source || searchParams.get("source") || "direct";
  const referralCode = useMemo(
    () => searchParams.get("ref") || attribution.ref || (typeof document !== "undefined" ? document.cookie.match(/(?:^|; )vplc_ref=([^;]+)/)?.[1] : "") || "",
    [searchParams, attribution.ref],
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "panNumber" && typeof value === "string") {
        next.panNumber = normalizePan(value);
      }
      return next;
    });
    setError("");
    if ((key === "mobile" && value !== form.mobile) || (key === "email" && value !== form.email)) {
      setOtpVerified(false);
      setOtpToken("");
      setOtpStarted(false);
      setOtpCode("");
      setOtpReqId("");
      setResendIn(0);
      resetMsg91EmailOtpClient();
      setOtpReady(false);
    }
  }

  async function lookupPin(pin: string) {
    if (!/^\d{6}$/.test(pin)) return;
    setPinLookupBusy(true);
    try {
      const response = await fetch(`/api/pincode?pin=${pin}`);
      const data = (await response.json()) as { city?: string; state?: string };
      if (response.ok && (data.city || data.state)) {
        setForm((current) => ({
          ...current,
          pinCode: pin,
          city: data.city || current.city,
          state: data.state || current.state,
        }));
      }
    } catch {
      // PIN autofill is best-effort; user can type city/state.
    } finally {
      setPinLookupBusy(false);
    }
  }

  async function ensureOtpPrepared() {
    await prepareMsg91EmailOtp(MSG91_WIDGET_ID, MSG91_WIDGET_TOKEN);
    setOtpReady(true);
  }

  async function sendEmailOtp() {
    if (looksLikeFakePersonName(form.fullName)) {
      setError("Enter your full name as on PAN (not a test or dummy value).");
      return;
    }
    if (isImpossibleMobile(form.mobile)) {
      setError("Enter a valid 10-digit Indian mobile number (not a placeholder or repeated digits).");
      return;
    }
    if (!EMAIL_PATTERN.test(form.email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!MSG91_WIDGET_ID || !MSG91_WIDGET_TOKEN) {
      setError("Email OTP is not configured. Set NEXT_PUBLIC_MSG91_WIDGET_ID and NEXT_PUBLIC_MSG91_WIDGET_TOKEN.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await ensureOtpPrepared();
      const sent = await sendMsg91EmailOtp(form.email.trim().toLowerCase());
      setOtpReqId(sent.reqId || "");
      setOtpStarted(true);
      setOtpCode("");
      setOtpVerified(false);
      setOtpToken("");
      setResendIn(45);
      trackEvent("email_otp_sent");
    } catch (err) {
      resetMsg91EmailOtpClient();
      setOtpReady(false);
      setOtpStarted(false);
      setError(err instanceof Error ? err.message : "Could not send verification code.");
    } finally {
      setBusy(false);
    }
  }

  async function resendEmailOtp() {
    if (resendIn > 0) return;
    setBusy(true);
    setError("");
    try {
      if (!otpReady) await ensureOtpPrepared();
      try {
        const retried = await retryMsg91EmailOtp(otpReqId || undefined);
        if (retried.reqId) setOtpReqId(retried.reqId);
      } catch {
        const sent = await sendMsg91EmailOtp(form.email.trim().toLowerCase());
        setOtpReqId(sent.reqId || "");
      }
      setResendIn(45);
      setOtpCode("");
      setOtpStarted(true);
    } catch (err) {
      resetMsg91EmailOtpClient();
      setOtpReady(false);
      setError(err instanceof Error ? err.message : "Could not resend code.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyEmailOtp() {
    if (otpCode.length !== 6) {
      setError("Enter the 6-digit verification code from your email.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (!otpReady) await ensureOtpPrepared();
      const accessToken = await verifyMsg91EmailOtp(otpCode, otpReqId || undefined);
      const response = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          mobile: form.mobile,
          email: form.email.trim().toLowerCase(),
          source,
          accessToken,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Email verification could not be completed.");
      setOtpVerified(true);
      setOtpToken(data.verificationToken);
      trackEvent("email_verified");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Email verification could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  function validateStep(current: number) {
    if (current === 1) {
      if (looksLikeFakePersonName(form.fullName)) return "Enter your full name as on PAN (not a test or dummy value).";
      if (isImpossibleMobile(form.mobile)) return "Enter a valid 10-digit Indian mobile number (not a placeholder or repeated digits).";
      if (!EMAIL_PATTERN.test(form.email)) return "Enter a valid email address.";
      if (!otpToken || !otpVerified) return "Please verify your email with OTP before continuing.";
      return "";
    }

    if (current === 2) {
      const pan = normalizePan(form.panNumber);
      const panCheck = getPanProvider().checkFormat(pan);
      if (panCheck.formatStatus !== "format_valid") return panCheck.message;
      if (!isIndividualPan(pan)) return "Use an individual PAN (4th character must be P) for this personal profile.";

      const age = ageFromDob(form.dateOfBirth);
      if (age === null) return "Enter a valid date of birth (YYYY-MM-DD).";
      if (age < 21) return "Applicant must be at least 21 years old for this product.";
      if (age > 60) return "Applicant age exceeds the supported limit for this product (60).";

      if (!form.employmentType) return "Choose how you earn.";
      if (looksLikeFakePersonName(form.employerOrBusinessName) || form.employerOrBusinessName.trim().length < 2) {
        return "Enter a meaningful employer or business name.";
      }
      if (!form.monthlyIncomeRange) return "Choose your monthly income range.";

      const loanAmount = Number(form.loanAmount);
      if (!form.loanAmount || !Number.isFinite(loanAmount) || loanAmount < 10000) {
        return "Choose a loan amount of at least ₹10,000.";
      }
      if (loanAmount > 1000000) {
        return "Maximum loan amount is ₹10,00,000.";
      }
      if (!form.loanPurpose.trim()) return "Choose what you need the money for.";

      if (form.existingEmi.trim() === "" || !/^\d+(\.\d+)?$/.test(form.existingEmi.trim())) {
        return "Enter your total existing monthly EMI (use 0 if none).";
      }
      const existingEmi = Number(form.existingEmi);
      if (!Number.isFinite(existingEmi) || existingEmi < 0) return "Existing EMI cannot be negative.";

      if (form.durationMonths.trim() === "" || !/^\d+$/.test(form.durationMonths.trim())) {
        return "Enter months employed / in business (1–480).";
      }
      const durationMonths = Number(form.durationMonths);
      if (!Number.isInteger(durationMonths) || durationMonths < 1 || durationMonths > 480) {
        return "Employment/business duration must be between 1 and 480 months.";
      }

      if (!form.creditRange) return "Choose your approximate credit range.";

      const consistency = evaluateIncomeLoanConsistency({
        monthlyIncomeRange: form.monthlyIncomeRange,
        existingEmi,
        loanAmount,
        durationMonths,
        employmentType: form.employmentType,
        dateOfBirth: form.dateOfBirth,
      });
      if (consistency[0]) return consistency[0].message;

      return "";
    }

    if (current === 3) {
      if (!/^\d{6}$/.test(form.pinCode)) return "Enter a valid 6-digit PIN code.";
      if (form.state.trim().length < 2) return "Enter your state.";
      if (form.city.trim().length < 2) return "Enter your city.";
      if (looksLikeWeakAddress(form.residentialAddress)) {
        return "Enter a complete residential address (house/street/locality), at least 12 characters.";
      }
      if (!form.residenceType) return "Choose your residence type.";
      if (form.monthsAtAddress.trim() === "" || !/^\d+$/.test(form.monthsAtAddress.trim())) {
        return "Enter how many months you have lived at this address.";
      }
      const monthsAtAddress = Number(form.monthsAtAddress);
      if (!Number.isInteger(monthsAtAddress) || monthsAtAddress < 0 || monthsAtAddress > 600) {
        return "Months at address must be between 0 and 600.";
      }
      return "";
    }

    if (current === 4) {
      if (!form.serviceConsent) return "Service consent is required to continue.";
      return "";
    }

    return "";
  }

  function goNext() {
    const issue = validateStep(step);
    if (issue) {
      setError(issue);
      return;
    }
    setError("");
    setStep((current) => Math.min(4, current + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setError("");
    setStep((current) => Math.max(1, current - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function buildPayload() {
    const monthly = incomeRangeMidpoints[form.monthlyIncomeRange as keyof typeof incomeRangeMidpoints] ?? 32500;
    const pan = normalizePan(form.panNumber);
    const panFormatOk = isValidPanFormat(pan) && isIndividualPan(pan);
    const existingEmi = Math.max(0, Number(form.existingEmi) || 0);
    const durationMonths = Math.min(480, Math.max(0, Number(form.durationMonths) || 0));
    const monthsAtAddress = Math.min(600, Math.max(0, Number(form.monthsAtAddress) || 0));

    return {
      fullName: form.fullName.trim(),
      mobile: form.mobile,
      email: form.email.trim(),
      panNumber: pan,
      dateOfBirth: form.dateOfBirth,
      state: form.state.trim(),
      city: form.city.trim(),
      residentialAddress: form.residentialAddress.trim(),
      pinCode: form.pinCode,
      residenceType: (form.residenceType || "OTHER") as ResidenceType,
      monthsAtAddress,
      loanAmount: Number(form.loanAmount) || 100000,
      loanPurpose: form.loanPurpose || "Other personal need",
      loanType: form.loanType || "PERSONAL",
      employmentType: form.employmentType,
      employerOrBusinessName: form.employerOrBusinessName.trim(),
      officeAddress: form.residentialAddress.trim(),
      monthlyIncomeRange: form.monthlyIncomeRange,
      annualIncome: Math.round(monthly * 12),
      durationMonths,
      salaryBankCredit: form.employmentType === "SALARIED",
      itrAvailable: false,
      gstAvailable: false,
      udyamAvailable: false,
      sixMonthBankStatement: form.sixMonthBankStatement,
      existingEmi,
      activeLoans: existingEmi > 0 ? 1 : 0,
      cardOutstanding: 0,
      currentOverdue: form.currentOverdue,
      settledOrWrittenOff: form.settledOrWrittenOff,
      creditRange: (form.creditRange || "UNKNOWN") as FormState["creditRange"],
      panFormatValidated: panFormatOk,
      panVerificationStatus: "not_verified" as const,
      panAvailable: panFormatOk,
      aadhaarAvailable: form.aadhaarAvailable,
      addressProofAvailable: form.addressProofAvailable,
      incomeProofAvailable: form.incomeProofAvailable,
      bankStatementAvailable: form.bankStatementAvailable,
      businessRegistrationAvailable: false,
      securedAssetAvailable: false,
      serviceConsent: form.serviceConsent,
      marketingConsent: form.marketingConsent,
      otpVerificationToken: otpToken,
      source,
      referralCode,
      utm: getAttributionPayload(searchParams),
    };
  }

  async function payNow() {
    const issue = validateStep(4);
    if (issue) {
      setError(issue);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/assessments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = (await response.json()) as {
        error?: string;
        fields?: Record<string, string[] | undefined>;
        assessmentId?: string;
        accessToken?: string;
      };
      if (!response.ok) {
        const fieldMessage = firstFieldError(data.fields);
        const base = data.error || "Unable to save your profile.";
        throw new Error(fieldMessage && fieldMessage !== base ? `${base} ${fieldMessage}` : fieldMessage || base);
      }
      trackEvent("assessment_completed");
      window.location.assign(`/result/${data.assessmentId}?token=${encodeURIComponent(data.accessToken || "")}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open payment.");
      setBusy(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-line/80 bg-white shadow-soft">
      <div className="border-b border-line bg-surface/80 px-4 py-5 sm:px-8">
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
          {STEPS.map((item, index) => {
            const done = step > item.id;
            const active = step === item.id;
            return (
              <div key={item.id} className="flex min-w-0 flex-1 items-center gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-extrabold",
                      done || active ? "bg-brand-600 text-white" : "bg-line text-slate-500",
                    )}
                  >
                    {done ? <Check size={14} /> : item.id}
                  </span>
                  <span className={cn("truncate text-[11px] font-bold uppercase tracking-[0.12em]", active ? "text-brand-700" : "text-slate-400")}>
                    {item.label}
                  </span>
                </div>
                {index < STEPS.length - 1 ? <span className="mx-1 hidden h-px flex-1 bg-line sm:block" /> : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-5 sm:p-8 lg:p-10">
        {step === 1 ? (
          <VerifyStep
            form={form}
            update={update}
            otpStarted={otpStarted}
            otpVerified={otpVerified || Boolean(otpToken)}
            busy={busy}
            otpCode={otpCode}
            setOtpCode={setOtpCode}
            resendIn={resendIn}
            sendEmailOtp={sendEmailOtp}
            resendEmailOtp={resendEmailOtp}
            verifyEmailOtp={verifyEmailOtp}
          />
        ) : null}
        {step === 2 ? <EligibilityStep form={form} update={update} /> : null}
        {step === 3 ? <AddressStep form={form} update={update} pinLookupBusy={pinLookupBusy} onPinBlur={lookupPin} /> : null}
        {step === 4 ? <UnlockStep form={form} update={update} /> : null}

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium leading-6 text-red-800" role="alert">
            {error}
          </div>
        ) : null}

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-6">
          <Button type="button" variant="ghost" disabled={step === 1 || busy} onClick={goBack}>
            <ArrowLeft size={18} /> Back
          </Button>
          {step < 4 ? (
            <Button type="button" disabled={busy} onClick={goNext}>
              Continue <ArrowRight size={18} />
            </Button>
          ) : (
            <Button type="button" disabled={busy} onClick={payNow}>
              {busy ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
              {busy ? "Opening payment…" : `Pay ${USP_PRICE_LABEL} & continue`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

type StepProps = {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
};

function VerifyStep({
  form,
  update,
  otpStarted,
  otpVerified,
  busy,
  otpCode,
  setOtpCode,
  resendIn,
  sendEmailOtp,
  resendEmailOtp,
  verifyEmailOtp,
}: StepProps & {
  otpStarted: boolean;
  otpVerified: boolean;
  busy: boolean;
  otpCode: string;
  setOtpCode: (value: string) => void;
  resendIn: number;
  sendEmailOtp: () => void;
  resendEmailOtp: () => void;
  verifyEmailOtp: () => void;
}) {
  return (
    <div>
      <div className="mx-auto mb-6 grid h-12 w-12 place-items-center rounded-full bg-brand-100 text-brand-700">
        <ShieldCheck size={22} />
      </div>
      <h2 className="text-center text-2xl font-extrabold tracking-[-0.04em] text-navy-950 sm:text-3xl">Verify your email</h2>
      <p className="mx-auto mt-3 max-w-md text-center text-sm leading-7 text-slate-600">
        Enter your name, mobile number (for contact/payment), and verify email with OTP before eligibility.
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-brand-700">
        <span className="inline-flex items-center gap-1.5">
          <LockKeyhole size={14} /> Email OTP only
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Sparkles size={14} /> 2-minute flow
        </span>
      </div>

      <div className="mt-8 grid gap-5">
        <Field label="Full name" required>
          <Input
            autoComplete="name"
            value={form.fullName}
            disabled={otpVerified}
            onChange={(e) => update("fullName", e.target.value)}
            placeholder="Name as on PAN"
          />
        </Field>

        <Field label="Mobile number" required hint="Used for contact and payment — not verified by SMS.">
          <Input
            className="number-field"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={10}
            value={form.mobile}
            disabled={otpVerified}
            onChange={(e) => update("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="Enter 10-digit number"
          />
        </Field>

        <Field label="Email" required hint="OTP arrives from VP Loan Connect — check inbox and spam">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              autoComplete="email"
              value={form.email}
              disabled={otpVerified || otpStarted}
              onChange={(e) => update("email", e.target.value.trim())}
              placeholder="Enter your email"
            />
            {!otpVerified ? (
              <Button
                type="button"
                variant="secondary"
                className="shrink-0 sm:min-w-40"
                disabled={busy || (otpStarted && resendIn > 0)}
                onClick={otpStarted ? resendEmailOtp : sendEmailOtp}
              >
                {busy ? <Loader2 className="animate-spin" size={17} /> : null}
                {!otpStarted ? "Get email code" : resendIn > 0 ? `Resend in ${resendIn}s` : "Resend email OTP"}
              </Button>
            ) : (
              <span className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-100 px-4 py-3 text-sm font-bold text-brand-800">
                <Check size={17} /> Email verified
              </span>
            )}
          </div>
        </Field>

        {otpStarted && !otpVerified ? (
          <Field label="6-digit email OTP" required hint="Enter the code from your email. Expires quickly — do not share it.">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                className="number-field tracking-[0.35em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
              />
              <Button type="button" className="shrink-0 sm:min-w-40" disabled={busy || otpCode.length !== 6} onClick={verifyEmailOtp}>
                {busy ? <Loader2 className="animate-spin" size={17} /> : null}
                Verify email
              </Button>
            </div>
          </Field>
        ) : null}
      </div>

      <p className="mt-6 rounded-2xl border border-brand-100 bg-brand-100/40 px-4 py-3 text-xs leading-6 text-brand-900">
        By continuing, you agree we may use these details for your profile assessment. Your data is encrypted in transit. Never share UPI PIN, CVV or Aadhaar OTP.
      </p>
    </div>
  );
}

function DocToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={cn("flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-bold transition", checked ? "border-brand-600 bg-brand-100/50 text-brand-800" : "border-line bg-white text-navy-900")}>
      <span>{label}</span>
      <Select
        className="min-h-11 w-28"
        value={checked ? "yes" : "no"}
        onChange={(e) => onChange(e.target.value === "yes")}
      >
        <option value="no">No</option>
        <option value="yes">Yes</option>
      </Select>
    </label>
  );
}

function EligibilityStep({ form, update }: StepProps) {
  const panCheck = getPanProvider().checkFormat(form.panNumber);
  const panFormatOk = panCheck.formatStatus === "format_valid" && isIndividualPan(form.panNumber);

  return (
    <div>
      <h2 className="text-2xl font-extrabold tracking-[-0.04em] text-navy-950 sm:text-3xl">Check your eligibility</h2>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        PAN, income and loan need — so we can match stronger lender options first. This is not a bureau enquiry.
      </p>

      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <Field
          label="PAN card number"
          required
          hint={
            panFormatOk
              ? "PAN format validated — identity verification pending"
              : form.panNumber.length > 0
                ? panCheck.message
                : "10-character individual PAN, e.g. ABCPG1234F"
          }
        >
          <Input
            className="uppercase tracking-[0.18em]"
            autoComplete="off"
            maxLength={10}
            value={form.panNumber}
            onChange={(e) => update("panNumber", e.target.value)}
            placeholder="ABCPG1234F"
            aria-invalid={form.panNumber.length > 0 && !panFormatOk ? true : undefined}
          />
        </Field>
        <Field label="Date of birth" required hint="Must be age 21–65">
          <Input
            type="date"
            autoComplete="bday"
            value={form.dateOfBirth}
            onChange={(e) => update("dateOfBirth", e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
          />
        </Field>
        <Field label="You work as" required>
          <Select value={form.employmentType} onChange={(e) => update("employmentType", e.target.value)}>
            <option value="">Choose one</option>
            <option value="SALARIED">Salaried employee</option>
            <option value="SELF_EMPLOYED">Self-employed / professional</option>
            <option value="BUSINESS_OWNER">Business owner</option>
            <option value="FREELANCER">Freelancer / gig</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>
        <Field label="Employer / business name" required>
          <Input
            value={form.employerOrBusinessName}
            onChange={(e) => update("employerOrBusinessName", e.target.value)}
            placeholder="e.g. Acme Pvt Ltd / My Shop"
          />
        </Field>
        <Field label="Months employed / in business" required hint="Total months in current employment or business">
          <Input
            className="number-field"
            inputMode="numeric"
            value={form.durationMonths}
            onChange={(e) => update("durationMonths", e.target.value.replace(/\D/g, "").slice(0, 3))}
            placeholder="e.g. 24"
          />
        </Field>
        <Field label="Monthly net income" required>
          <Select value={form.monthlyIncomeRange} onChange={(e) => update("monthlyIncomeRange", e.target.value)}>
            <option value="">Choose income range</option>
            <option value="BELOW_15000">Below ₹15,000</option>
            <option value="15000_24999">₹15,000–₹24,999</option>
            <option value="25000_39999">₹25,000–₹39,999</option>
            <option value="40000_59999">₹40,000–₹59,999</option>
            <option value="60000_99999">₹60,000–₹99,999</option>
            <option value="100000_149999">₹1,00,000–₹1,49,999</option>
            <option value="150000_PLUS">₹1,50,000+</option>
          </Select>
        </Field>
        <Field label="Existing monthly EMI total" required hint="Use 0 if you have no EMIs">
          <Input
            className="number-field"
            inputMode="numeric"
            value={form.existingEmi}
            onChange={(e) => update("existingEmi", e.target.value.replace(/[^\d.]/g, "").slice(0, 10))}
            placeholder="e.g. 8500"
          />
        </Field>
        <Field label="Loan amount needed" required>
          <Select value={form.loanAmount} onChange={(e) => update("loanAmount", e.target.value)}>
            <option value="10000">₹10,000</option>
            <option value="25000">₹25,000</option>
            <option value="50000">₹50,000</option>
            <option value="100000">₹1,00,000</option>
            <option value="200000">₹2,00,000</option>
            <option value="500000">₹5,00,000</option>
          </Select>
        </Field>
        <Field label="Purpose" required>
          <Select
            value={form.loanPurpose}
            onChange={(e) => {
              const purpose = e.target.value;
              update("loanPurpose", purpose);
              update("loanType", purpose === "Business working capital" ? "BUSINESS" : "PERSONAL");
            }}
          >
            <option value="Medical or emergency expense">Medical / emergency</option>
            <option value="Other personal need">Personal need</option>
            <option value="Household bills or family need">Household / family</option>
            <option value="Travel or wedding">Travel / wedding</option>
            <option value="Education expense">Education</option>
            <option value="Business working capital">Business working capital</option>
          </Select>
        </Field>
        <Field label="CIBIL / credit range (approx)" required hint="Self-reported — no bureau pull">
          <Select value={form.creditRange} onChange={(e) => update("creditRange", e.target.value)}>
            <option value="UNKNOWN">I don&apos;t know</option>
            <option value="BELOW_550">Below 550</option>
            <option value="550_599">550–599</option>
            <option value="600_649">600–649</option>
            <option value="650_699">650–699</option>
            <option value="700_749">700–749</option>
            <option value="750_PLUS">750+</option>
          </Select>
        </Field>
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-extrabold uppercase tracking-[0.12em] text-slate-500">Document readiness</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">Answer honestly. Unchecked means not currently available — do not claim documents you do not have.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <DocToggle label="Aadhaar available" checked={form.aadhaarAvailable} onChange={(v) => update("aadhaarAvailable", v)} />
          <DocToggle label="Address proof available" checked={form.addressProofAvailable} onChange={(v) => update("addressProofAvailable", v)} />
          <DocToggle label="Income proof available" checked={form.incomeProofAvailable} onChange={(v) => update("incomeProofAvailable", v)} />
          <DocToggle label="Bank statement available" checked={form.bankStatementAvailable} onChange={(v) => update("bankStatementAvailable", v)} />
          <DocToggle label="6-month bank statement" checked={form.sixMonthBankStatement} onChange={(v) => update("sixMonthBankStatement", v)} />
          <DocToggle label="Any current overdue" checked={form.currentOverdue} onChange={(v) => update("currentOverdue", v)} />
          <DocToggle label="Settled or written-off history" checked={form.settledOrWrittenOff} onChange={(v) => update("settledOrWrittenOff", v)} />
        </div>
      </div>
    </div>
  );
}

function AddressStep({
  form,
  update,
  pinLookupBusy,
  onPinBlur,
}: StepProps & { pinLookupBusy: boolean; onPinBlur: (pin: string) => void }) {
  return (
    <div>
      <h2 className="text-2xl font-extrabold tracking-[-0.04em] text-navy-950 sm:text-3xl">Address details</h2>
      <p className="mt-3 text-sm leading-7 text-slate-600">Where you currently live. PIN auto-fills city and state when possible.</p>

      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <Field label="PIN code" required hint={pinLookupBusy ? "Looking up city…" : "6 digits"}>
          <div className="relative">
            <Input
              inputMode="numeric"
              maxLength={6}
              value={form.pinCode}
              onChange={(e) => {
                const pin = e.target.value.replace(/\D/g, "").slice(0, 6);
                update("pinCode", pin);
                if (pin.length === 6) void onPinBlur(pin);
              }}
              onBlur={(e) => void onPinBlur(e.target.value)}
              placeholder="201009"
            />
            {pinLookupBusy ? <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" size={16} /> : null}
          </div>
        </Field>
        <Field label="State" required>
          <Input autoComplete="address-level1" value={form.state} onChange={(e) => update("state", e.target.value)} placeholder="e.g. Uttar Pradesh" />
        </Field>
        <Field label="City" required>
          <Input autoComplete="address-level2" value={form.city} onChange={(e) => update("city", e.target.value)} placeholder="e.g. Greater Noida" />
        </Field>
        <Field label="Residence type" required>
          <Select value={form.residenceType} onChange={(e) => update("residenceType", e.target.value as ResidenceType | "")}>
            <option value="">Choose one</option>
            <option value="OWNED">Owned</option>
            <option value="RENTED">Rented</option>
            <option value="PARENTAL">Parental / family</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>
        <Field label="Months at this address" required>
          <Input
            className="number-field"
            inputMode="numeric"
            value={form.monthsAtAddress}
            onChange={(e) => update("monthsAtAddress", e.target.value.replace(/\D/g, "").slice(0, 3))}
            placeholder="e.g. 18"
          />
        </Field>
        <Field label="Residential address" required hint="House / street / locality — at least 12 characters">
          <Input
            autoComplete="street-address"
            value={form.residentialAddress}
            onChange={(e) => update("residentialAddress", e.target.value)}
            placeholder="House / street / landmark"
          />
        </Field>
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-sm leading-6 text-slate-600">
        <MapPin className="mt-0.5 shrink-0 text-brand-700" size={18} />
        We do not pull bank accounts or Aadhaar OTP. Official lenders handle KYC on their sites after you choose a connect link.
      </div>
    </div>
  );
}

function UnlockStep({ form, update }: StepProps) {
  return (
    <div>
      <div className="rounded-[1.5rem] bg-navy-950 p-6 text-white sm:p-8">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-500/15 px-3 py-1.5 text-xs font-extrabold text-brand-300">
          <Zap size={14} /> Final step
        </span>
        <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">Unlock matched options</h2>
        <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">
          {USP_PRODUCT_NAME}: profile analysis + official partner apply links ranked for your answers. Not a lender fee. Not an approval.
        </p>
        <p className="mt-6 text-5xl font-extrabold text-brand-400">
          {USP_PRICE_LABEL} <span className="text-base font-bold text-slate-400">+ GST</span>
        </p>
        <p className="mt-2 text-sm font-bold text-slate-300">Total payable: {USP_TOTAL_WITH_GST_LABEL}</p>
      </div>

      <div className="mt-5 grid gap-3 rounded-2xl border border-line bg-surface p-5 text-sm text-slate-700 sm:grid-cols-2">
        <p>
          <strong>Name:</strong> {form.fullName}
        </p>
        <p>
          <strong>PAN:</strong> {maskPan(form.panNumber)}
        </p>
        <p>
          <strong>Need:</strong> ₹{Number(form.loanAmount).toLocaleString("en-IN")} · {form.loanPurpose}
        </p>
        <p>
          <strong>City:</strong> {form.city}, {form.state}
        </p>
      </div>

      <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-950">
        Results are indicative only — not a loan approval, sanction, or credit decision. Lenders make their own decisions after you apply on their official sites.
      </p>

      <div className="mt-6 grid gap-3">
        {["Credit profile explanation", "Loan-readiness analysis", "Best-fit lenders shown first", "Official apply links (you click voluntarily)"].map((item) => (
          <p key={item} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Check className="shrink-0 text-brand-600" size={17} />
            {item}
          </p>
        ))}
      </div>

      <p className="mt-5 text-xs leading-6 text-slate-500">{PAYMENT_DESCRIPTION}</p>

      <div className="mt-6 grid gap-4">
        <label className={cn("flex cursor-pointer items-start gap-4 rounded-2xl border p-5 transition", form.serviceConsent ? "border-brand-600 bg-brand-100/60" : "border-line bg-white")}>
          <input className="mt-1 h-5 w-5 shrink-0 accent-brand-600" type="checkbox" checked={form.serviceConsent} onChange={(e) => update("serviceConsent", e.target.checked)} />
          <span>
            <span className="flex items-center gap-2 text-sm font-bold text-navy-950">
              <ShieldCheck size={16} className="text-brand-700" /> Required service consent
            </span>
            <span className="mt-2 block text-sm leading-7 text-slate-600">{SERVICE_CONSENT_TEXT}</span>
          </span>
        </label>
        <label className={cn("flex cursor-pointer items-start gap-4 rounded-2xl border p-5 transition", form.marketingConsent ? "border-brand-600 bg-brand-100/60" : "border-line bg-white")}>
          <input className="mt-1 h-5 w-5 shrink-0 accent-brand-600" type="checkbox" checked={form.marketingConsent} onChange={(e) => update("marketingConsent", e.target.checked)} />
          <span>
            <span className="block text-sm font-bold text-navy-950">Optional marketing consent</span>
            <span className="mt-2 block text-sm leading-7 text-slate-600">{MARKETING_CONSENT_TEXT}</span>
          </span>
        </label>
      </div>
    </div>
  );
}
