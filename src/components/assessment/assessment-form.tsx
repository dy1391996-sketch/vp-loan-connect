"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { incomeRangeMidpoints } from "@/lib/domain/scoring";
import { cn } from "@/lib/utils";

type FormState = {
  fullName: string;
  mobile: string;
  email: string;
  panNumber: string;
  state: string;
  city: string;
  residentialAddress: string;
  pinCode: string;
  loanAmount: string;
  loanPurpose: string;
  loanType: string;
  employmentType: string;
  employerOrBusinessName: string;
  monthlyIncomeRange: string;
  creditRange: string;
  serviceConsent: boolean;
  marketingConsent: boolean;
};

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const MSG91_WIDGET_ID = process.env.NEXT_PUBLIC_MSG91_WIDGET_ID ?? "";
const MSG91_WIDGET_TOKEN = process.env.NEXT_PUBLIC_MSG91_WIDGET_TOKEN ?? "";

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
  state: "",
  city: "",
  residentialAddress: "",
  pinCode: "",
  loanAmount: "100000",
  loanPurpose: "Other personal need",
  loanType: "PERSONAL",
  employmentType: "",
  employerOrBusinessName: "",
  monthlyIncomeRange: "",
  creditRange: "UNKNOWN",
  serviceConsent: false,
  marketingConsent: false,
};

function getMsg91AccessToken(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const key of ["accessToken", "access-token", "token"]) {
    if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
  }
  for (const child of Object.values(record)) {
    const token = getMsg91AccessToken(child);
    if (token) return token;
  }
  return "";
}

export function AssessmentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initialState);
  const [otpStarted, setOtpStarted] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpToken, setOtpToken] = useState("");
  const [pinLookupBusy, setPinLookupBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    trackEvent("assessment_started");
  }, []);

  useEffect(() => {
    captureAttributionFromSearch(searchParams);
    const amount = searchParams.get("amount") || searchParams.get("loanAmount");
    const loanType = searchParams.get("loanType") || searchParams.get("type");
    const purpose = searchParams.get("purpose") || searchParams.get("loanPurpose");

    setForm((current) => {
      const next = { ...current };
      let changed = false;
      if (amount && /^\d+$/.test(amount)) {
        next.loanAmount = String(Math.min(500000, Math.max(5000, Number(amount))));
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
        next.panNumber = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
      }
      return next;
    });
    setError("");
    if ((key === "mobile" || key === "email") && value !== form[key]) {
      setOtpVerified(false);
      setOtpToken("");
      setOtpStarted(false);
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

  async function requestOtp() {
    if (form.fullName.trim().length < 2 || !/^[6-9]\d{9}$/.test(form.mobile) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError("Enter your full name, a valid 10-digit mobile number and email address.");
      return;
    }
    if (!MSG91_WIDGET_ID || !MSG91_WIDGET_TOKEN) {
      setError("MSG91 OTP widget is not configured. Set NEXT_PUBLIC_MSG91_WIDGET_ID and NEXT_PUBLIC_MSG91_WIDGET_TOKEN.");
      return;
    }

    setBusy(true);
    setError("");
    setOtpStarted(true);

    const completeVerification = async (widgetResponse: unknown) => {
      try {
        const accessToken = getMsg91AccessToken(widgetResponse);
        if (!accessToken) throw new Error("MSG91 verification token was not received. Please try again.");
        const response = await fetch("/api/otp/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ fullName: form.fullName, mobile: form.mobile, email: form.email, source, accessToken }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Email verification could not be completed.");
        setOtpVerified(true);
        setOtpToken(data.verificationToken);
        trackEvent("email_verified");
      } catch (err) {
        setOtpStarted(false);
        setError(err instanceof Error ? err.message : "Email verification could not be completed.");
      } finally {
        setBusy(false);
      }
    };

    const failVerification = (reason: unknown) => {
      console.error("msg91_widget_failed", reason);
      setOtpStarted(false);
      setBusy(false);
      setError("OTP verification was not completed. Please try again.");
    };

    const configuration = {
      widgetId: MSG91_WIDGET_ID,
      tokenAuth: MSG91_WIDGET_TOKEN,
      identifier: form.email,
      success: (data: unknown) => {
        void completeVerification(data);
      },
      failure: failVerification,
    };

    try {
      const widgetWindow = window as Window & { initSendOTP?: (config: typeof configuration) => void };
      const launch = () => {
        if (typeof widgetWindow.initSendOTP !== "function") throw new Error("MSG91 OTP service did not start.");
        widgetWindow.initSendOTP(configuration);
      };
      if (typeof widgetWindow.initSendOTP === "function") {
        launch();
        return;
      }
      const urls = ["https://verify.msg91.com/otp-provider.js", "https://verify.phone91.com/otp-provider.js"];
      let index = 0;
      const loadNext = () => {
        const script = document.createElement("script");
        script.src = urls[index];
        script.async = true;
        script.onload = () => {
          try {
            launch();
          } catch (err) {
            failVerification(err);
          }
        };
        script.onerror = () => {
          index += 1;
          if (index < urls.length) loadNext();
          else failVerification(new Error("MSG91 OTP service unavailable"));
        };
        document.head.appendChild(script);
      };
      loadNext();
    } catch (err) {
      failVerification(err);
    }
  }

  function validateStep(current: number) {
    if (current === 1) {
      if (form.fullName.trim().length < 2) return "Enter your full name as on PAN.";
      if (!/^[6-9]\d{9}$/.test(form.mobile)) return "Enter a valid 10-digit Indian mobile number.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Enter a valid email address.";
      if (!otpToken) return "Please verify your email with OTP before continuing.";
      return "";
    }
    if (current === 2) {
      if (!PAN_PATTERN.test(form.panNumber)) return "Enter a valid 10-character PAN (e.g. ABCDE1234F).";
      if (!form.employmentType) return "Choose how you earn.";
      if (!form.monthlyIncomeRange) return "Choose your monthly income range.";
      if (!form.loanAmount || Number(form.loanAmount) < 5000) return "Choose a loan amount of at least ₹5,000.";
      if (!form.loanPurpose.trim()) return "Choose what you need the money for.";
      return "";
    }
    if (current === 3) {
      if (!/^\d{6}$/.test(form.pinCode)) return "Enter a valid 6-digit PIN code.";
      if (form.state.trim().length < 2) return "Enter your state.";
      if (form.city.trim().length < 2) return "Enter your city.";
      if (form.residentialAddress.trim().length < 8) return "Enter your full residential address.";
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
    const isBusiness = ["SELF_EMPLOYED", "BUSINESS_OWNER", "FREELANCER"].includes(form.employmentType);
    const employer =
      form.employerOrBusinessName.trim() ||
      (form.employmentType === "SALARIED" ? "Employer" : isBusiness ? "Self / Business" : "Self");

    return {
      fullName: form.fullName.trim(),
      mobile: form.mobile,
      email: form.email.trim(),
      panNumber: form.panNumber.toUpperCase(),
      state: form.state.trim(),
      city: form.city.trim(),
      residentialAddress: form.residentialAddress.trim(),
      pinCode: form.pinCode,
      loanAmount: Number(form.loanAmount) || 100000,
      loanPurpose: form.loanPurpose || "Other personal need",
      loanType: form.loanType || "PERSONAL",
      employmentType: form.employmentType,
      employerOrBusinessName: employer,
      officeAddress: form.residentialAddress.trim(),
      monthlyIncomeRange: form.monthlyIncomeRange,
      annualIncome: Math.round(monthly * 12),
      durationMonths: 12,
      salaryBankCredit: form.employmentType === "SALARIED",
      itrAvailable: isBusiness,
      gstAvailable: form.employmentType === "BUSINESS_OWNER",
      udyamAvailable: false,
      sixMonthBankStatement: true,
      existingEmi: 0,
      activeLoans: 0,
      cardOutstanding: 0,
      currentOverdue: false,
      settledOrWrittenOff: false,
      creditRange: (form.creditRange || "UNKNOWN") as FormState["creditRange"],
      panAvailable: true,
      aadhaarAvailable: true,
      addressProofAvailable: true,
      incomeProofAvailable: true,
      bankStatementAvailable: true,
      businessRegistrationAvailable: form.employmentType === "BUSINESS_OWNER",
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
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save your profile.");
      trackEvent("assessment_completed");
      trackEvent("checkout_redirect_early");
      router.push(`/checkout?product=credit-health-action-plan&assessment=${data.assessmentId}&token=${encodeURIComponent(data.accessToken)}`);
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
          <VerifyStep form={form} update={update} otpStarted={otpStarted} otpVerified={otpVerified || Boolean(otpToken)} busy={busy} requestOtp={requestOtp} />
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
              Pay {USP_PRICE_LABEL} & unlock
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
  requestOtp,
}: StepProps & { otpStarted: boolean; otpVerified: boolean; busy: boolean; requestOtp: () => void }) {
  return (
    <div>
      <div className="mx-auto mb-6 grid h-12 w-12 place-items-center rounded-full bg-brand-100 text-brand-700">
        <ShieldCheck size={22} />
      </div>
      <h2 className="text-center text-2xl font-extrabold tracking-[-0.04em] text-navy-950 sm:text-3xl">Verify to continue</h2>
      <p className="mx-auto mt-3 max-w-md text-center text-sm leading-7 text-slate-600">
        Check eligibility in minutes. Safe, digital process — no lender decision here.
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-brand-700">
        <span className="inline-flex items-center gap-1.5">
          <LockKeyhole size={14} /> Bank-grade OTP
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Sparkles size={14} /> 2-minute flow
        </span>
      </div>

      <div className="mt-8 grid gap-5">
        <Field label="Full name" required>
          <Input autoComplete="name" value={form.fullName} onChange={(e) => update("fullName", e.target.value)} placeholder="Name as on PAN" />
        </Field>
        <Field label="Mobile number" required hint="Prefer the number linked to WhatsApp">
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
        <Field label="Email" required hint="OTP arrives from VP Loan Connect">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              autoComplete="email"
              value={form.email}
              disabled={otpVerified}
              onChange={(e) => update("email", e.target.value.trim())}
              placeholder="Enter your email"
            />
            {!otpVerified ? (
              <Button type="button" variant="secondary" className="shrink-0 sm:min-w-40" disabled={busy} onClick={requestOtp}>
                {busy ? <Loader2 className="animate-spin" size={17} /> : null}
                {otpStarted ? "Resend OTP" : "Get verification code"}
              </Button>
            ) : (
              <span className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-100 px-4 py-3 text-sm font-bold text-brand-800">
                <Check size={17} /> Verified
              </span>
            )}
          </div>
        </Field>
      </div>

      <p className="mt-6 rounded-2xl border border-brand-100 bg-brand-100/40 px-4 py-3 text-xs leading-6 text-brand-900">
        By continuing, you agree we may use these details for your profile assessment. Your data is encrypted in transit. Never share UPI PIN, CVV or Aadhaar OTP.
      </p>
    </div>
  );
}

function EligibilityStep({ form, update }: StepProps) {
  return (
    <div>
      <h2 className="text-2xl font-extrabold tracking-[-0.04em] text-navy-950 sm:text-3xl">Check your eligibility</h2>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        PAN, income and loan need — so we can match stronger lender options first. This is not a bureau enquiry.
      </p>

      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <Field label="PAN card number" required hint="10-character PAN, e.g. ABCDE1234F">
          <Input
            className="uppercase tracking-[0.18em]"
            autoComplete="off"
            maxLength={10}
            value={form.panNumber}
            onChange={(e) => update("panNumber", e.target.value)}
            placeholder="ABCDE1234F"
            aria-invalid={form.panNumber.length > 0 && !PAN_PATTERN.test(form.panNumber) ? true : undefined}
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
        <Field label="Company / shop name" hint="Optional but improves matching">
          <Input
            value={form.employerOrBusinessName}
            onChange={(e) => update("employerOrBusinessName", e.target.value)}
            placeholder="e.g. Acme Pvt Ltd / My Shop"
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
        <Field label="CIBIL / credit range (approx)" hint="Self-reported — no bureau pull">
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
        <Field label="Residential address" required>
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
          <strong>PAN:</strong> {form.panNumber}
        </p>
        <p>
          <strong>Need:</strong> ₹{Number(form.loanAmount).toLocaleString("en-IN")} · {form.loanPurpose}
        </p>
        <p>
          <strong>City:</strong> {form.city}, {form.state}
        </p>
      </div>

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
