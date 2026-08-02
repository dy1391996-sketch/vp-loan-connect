"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, LockKeyhole, MessageSquareText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Choice, Field, Input, Select } from "@/components/ui/form";
import { MARKETING_CONSENT_TEXT, SERVICE_CONSENT_TEXT } from "@/lib/constants";
import { trackEvent } from "@/lib/analytics-client";
import { cn } from "@/lib/utils";

type FormState = {
  fullName: string; mobile: string; email: string; state: string; city: string; residentialAddress: string; pinCode: string; loanAmount: string; loanPurpose: string; loanType: string;
  employmentType: string; employerOrBusinessName: string; officeAddress: string; monthlyIncomeRange: string; annualIncome: string; durationMonths: string; salaryBankCredit: boolean | null; itrAvailable: boolean | null; gstAvailable: boolean | null; udyamAvailable: boolean | null; sixMonthBankStatement: boolean | null;
  existingEmi: string; activeLoans: string; cardOutstanding: string; currentOverdue: boolean | null; settledOrWrittenOff: boolean | null; creditRange: string;
  panAvailable: boolean | null; aadhaarAvailable: boolean | null; addressProofAvailable: boolean | null; incomeProofAvailable: boolean | null; bankStatementAvailable: boolean | null; businessRegistrationAvailable: boolean | null; securedAssetAvailable: boolean | null;
  serviceConsent: boolean; marketingConsent: boolean;
};

const initialState: FormState = {
  fullName: "", mobile: "", email: "", state: "", city: "", residentialAddress: "", pinCode: "", loanAmount: "", loanPurpose: "", loanType: "",
  employmentType: "", employerOrBusinessName: "", officeAddress: "", monthlyIncomeRange: "", annualIncome: "", durationMonths: "", salaryBankCredit: null, itrAvailable: null, gstAvailable: null, udyamAvailable: null, sixMonthBankStatement: null,
  existingEmi: "0", activeLoans: "0", cardOutstanding: "0", currentOverdue: null, settledOrWrittenOff: null, creditRange: "",
  panAvailable: null, aadhaarAvailable: null, addressProofAvailable: null, incomeProofAvailable: null, bankStatementAvailable: null, businessRegistrationAvailable: null, securedAssetAvailable: null,
  serviceConsent: false, marketingConsent: false,
};

const steps = ["Loan Need", "Income", "CIBIL", "Documents", "Finish"];
const MSG91_WIDGET_ID = "36674474665a323737323137";
const MSG91_WIDGET_TOKEN = "555142TvR76oBwmFeV6a6bb64dP1";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { trackEvent("assessment_started"); }, []);

  const source = searchParams.get("utm_source") || "direct";
  const referralCode = useMemo(() => searchParams.get("ref") || (typeof document !== "undefined" ? document.cookie.match(/(?:^|; )vplc_ref=([^;]+)/)?.[1] : "") || "", [searchParams]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
    if ((key === "mobile" || key === "email") && value !== form[key]) { setOtpVerified(false); setOtpToken(""); setOtpStarted(false); }
  }

  async function requestOtp() {
    if (form.fullName.trim().length < 2 || !/^[6-9]\d{9}$/.test(form.mobile) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError("Enter your full name, a valid 10-digit mobile number and email address.");
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
      exposeMethods: false,
      success: completeVerification,
      failure: failVerification,
    };

    const widgetWindow = window as Window & { initSendOTP?: (config: typeof configuration) => void };
    const launch = () => {
      if (typeof widgetWindow.initSendOTP !== "function") throw new Error("MSG91 OTP service did not start.");
      widgetWindow.initSendOTP(configuration);
    };

    try {
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
          try { launch(); } catch (err) { failVerification(err); }
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

  function validateCurrentStep() {
    if (step === 1) {
      const missing: string[] = [];
      if (!form.loanAmount) missing.push("loan amount");
      if (!form.loanPurpose) missing.push("loan purpose");
      if (!form.loanType) missing.push("loan option");
      if (!form.fullName) missing.push("full name");
      if (!form.mobile) missing.push("mobile number");
      if (!form.email) missing.push("email address");
      if (!otpToken) missing.push("email verification");
      if (!form.state) missing.push("state");
      if (!form.city) missing.push("city");
      if (!form.residentialAddress) missing.push("residential address");
      if (!/^\d{6}$/.test(form.pinCode)) missing.push("6-digit PIN code");
      if (missing.length) return `Please complete: ${missing.join(", ")}.`;
    }
    if (step === 2 && (!form.employmentType || !form.employerOrBusinessName || !form.officeAddress || !form.monthlyIncomeRange || form.annualIncome === "" || form.durationMonths === "" || [form.salaryBankCredit, form.itrAvailable, form.gstAvailable, form.udyamAvailable, form.sixMonthBankStatement].some((v) => v === null))) return "Answer all income and employment questions.";
    if (step === 3 && (form.existingEmi === "" || form.activeLoans === "" || form.cardOutstanding === "" || form.currentOverdue === null || form.settledOrWrittenOff === null || !form.creditRange)) return "Answer all credit and obligation questions.";
    if (step === 4 && [form.panAvailable, form.aadhaarAvailable, form.addressProofAvailable, form.incomeProofAvailable, form.bankStatementAvailable, form.businessRegistrationAvailable, form.securedAssetAvailable].some((v) => v === null)) return "Answer all document-readiness questions.";
    if (step === 5 && !form.serviceConsent) return "Service consent is required to generate your result.";
    return "";
  }

  function next() {
    const issue = validateCurrentStep();
    if (issue) { setError(issue); return; }
    setStep((value) => Math.min(5, value + 1)); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    const issue = validateCurrentStep();
    if (issue) { setError(issue); return; }
    setBusy(true); setError("");
    const payload = {
      ...form,
      loanAmount: Number(form.loanAmount), annualIncome: Number(form.annualIncome), durationMonths: Number(form.durationMonths), existingEmi: Number(form.existingEmi), activeLoans: Number(form.activeLoans), cardOutstanding: Number(form.cardOutstanding),
      otpVerificationToken: otpToken, source, referralCode,
      utm: Object.fromEntries(["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].map((key) => [key, searchParams.get(key)]).filter((entry): entry is [string, string] => Boolean(entry[1]))),
    };
    try {
      const response = await fetch("/api/assessments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) {
        const invalidFields = data.fields && typeof data.fields === "object" ? Object.keys(data.fields) : [];
        const stepOne = ["fullName", "mobile", "email", "state", "city", "residentialAddress", "pinCode", "loanAmount", "loanPurpose", "loanType", "otpVerificationToken"];
        const stepTwo = ["employmentType", "employerOrBusinessName", "officeAddress", "monthlyIncomeRange", "annualIncome", "durationMonths", "salaryBankCredit", "itrAvailable", "gstAvailable", "udyamAvailable", "sixMonthBankStatement"];
        const stepThree = ["existingEmi", "activeLoans", "cardOutstanding", "currentOverdue", "settledOrWrittenOff", "creditRange"];
        if (invalidFields.some((field) => stepOne.includes(field))) setStep(1);
        else if (invalidFields.some((field) => stepTwo.includes(field))) setStep(2);
        else if (invalidFields.some((field) => stepThree.includes(field))) setStep(3);
        else if (invalidFields.length) setStep(4);
        throw new Error(data.error || (invalidFields.length ? `Please check: ${invalidFields.join(", ")}.` : "Unable to complete assessment."));
      }
      trackEvent("assessment_completed");
      router.push(`/result/${data.assessmentId}?token=${encodeURIComponent(data.accessToken)}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to complete assessment."); setBusy(false); }
  }

  return (
    <div className="overflow-hidden rounded-[2rem] border border-line/80 bg-white shadow-soft">
      <div className="bg-navy-950 px-5 py-7 text-white sm:px-9">
        <div className="flex items-center justify-between text-xs font-bold text-slate-300"><span>Step {step} of 5</span><span className="text-brand-100">{steps[step - 1]}</span></div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-brand-500 transition-all duration-500" style={{ width: `${step * 20}%` }} /></div>
        <div className="mt-4 hidden grid-cols-5 gap-3 text-[10px] font-semibold text-slate-400 sm:grid">{steps.map((label, index) => <span key={label} className={cn(index + 1 <= step && "text-brand-500")} aria-current={index + 1 === step ? "step" : undefined}>{label}</span>)}</div>
      </div>
      <div className="p-5 sm:p-9 lg:p-11">
        {step === 1 ? <BasicStep form={form} update={update} otpStarted={otpStarted} otpVerified={otpVerified || Boolean(otpToken)} busy={busy} requestOtp={requestOtp} /> : null}
        {step === 2 ? <IncomeStep form={form} update={update} /> : null}
        {step === 3 ? <ObligationStep form={form} update={update} /> : null}
        {step === 4 ? <DocumentStep form={form} update={update} /> : null}
        {step === 5 ? <ConsentStep form={form} update={update} /> : null}
        {error ? <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium leading-6 text-red-800" role="alert">{error}</div> : null}
        <div className="mt-9 flex items-center justify-between gap-3 border-t border-line pt-7">
          <Button type="button" variant="ghost" disabled={step === 1 || busy} onClick={() => setStep((value) => value - 1)}><ArrowLeft size={18} />Back</Button>
          {step < 5 ? <Button type="button" disabled={busy} onClick={next}>Continue <ArrowRight size={18} /></Button> : <Button type="button" disabled={busy} onClick={submit}>{busy ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}View My Matches</Button>}
        </div>
      </div>
    </div>
  );
}

type StepProps = { form: FormState; update: <K extends keyof FormState>(key: K, value: FormState[K]) => void };

function BasicStep({ form, update, otpStarted, otpVerified, busy, requestOtp }: StepProps & { otpStarted: boolean; otpVerified: boolean; busy: boolean; requestOtp: () => void }) {
  const quickAmounts = ["10000", "25000", "50000", "100000", "200000", "500000"];
  return (
    <div>
      <StepTitle title="How much money do you need?" description="Choose your amount first. Your free indicative result comes before any payment." />
      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <Field label="Select a loan amount" required hint="Choose a quick amount or enter your own from ₹5,000 to ₹5,00,000">
          <div className="mb-3 grid grid-cols-3 gap-2">
            {quickAmounts.map((amount) => (
              <button key={amount} type="button" onClick={() => update("loanAmount", amount)} className={cn("rounded-xl border px-3 py-3 text-sm font-extrabold transition", form.loanAmount === amount ? "border-brand-600 bg-brand-100 text-brand-800" : "border-line bg-white text-navy-950 hover:border-brand-500")}>
                {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(amount))}
              </button>
            ))}
          </div>
          <Input className="number-field" type="number" inputMode="numeric" min={5000} max={500000} step={1000} value={form.loanAmount} onChange={(e) => update("loanAmount", e.target.value)} placeholder="Enter another amount" />
        </Field>
        <div className="grid gap-5">
          <Field label="Why do you need the loan?" required><Select value={form.loanPurpose} onChange={(e) => update("loanPurpose", e.target.value)}><option value="">Choose a purpose</option><option value="Medical or emergency expense">Medical or emergency</option><option value="Household bills or family need">Household or family need</option><option value="Education expense">Education</option><option value="Home repair or purchase">Home repair or purchase</option><option value="Travel or wedding">Travel or wedding</option><option value="Business working capital">Business need</option><option value="Other personal need">Other personal need</option></Select></Field>
          <Field label="Which option is closest to your need?" required><Select value={form.loanType} onChange={(e) => update("loanType", e.target.value)}><option value="">Choose one</option><option value="PERSONAL">Personal loan / quick cash</option><option value="BUSINESS">Money for my business</option><option value="GOLD">Loan against gold</option><option value="PROPERTY">Loan against property</option><option value="CREDIT_HEALTH">Improve eligibility before applying</option></Select></Field>
        </div>
      </div>

      <div className="my-8 border-t border-line" />
      <h3 className="text-lg font-extrabold text-navy-950">Your contact details</h3>
      <p className="mt-2 text-sm text-slate-600">We use email OTP to secure your profile result.</p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field label="Full name" required><Input autoComplete="name" value={form.fullName} onChange={(e) => update("fullName", e.target.value)} placeholder="Your full name" /></Field>
        <Field label="WhatsApp mobile number" required hint="10-digit Indian mobile number"><Input className="number-field" inputMode="numeric" autoComplete="tel" maxLength={10} value={form.mobile} disabled={otpVerified} onChange={(e) => update("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="98XXXXXXXX" /></Field>
        <Field label="Email address" required hint="We will send the OTP to this email"><div className="flex gap-2"><Input type="email" autoComplete="email" value={form.email} disabled={otpVerified} onChange={(e) => update("email", e.target.value.trim())} placeholder="name@example.com" />{!otpVerified ? <Button type="button" variant="secondary" className="shrink-0" disabled={busy} onClick={requestOtp}>{busy ? <Loader2 className="animate-spin" size={17} /> : null}{otpStarted ? "Resend OTP" : "Verify email"}</Button> : <span className="grid min-w-12 place-items-center rounded-xl bg-brand-100 text-brand-700"><Check size={19} /></span>}</div>{otpStarted && !otpVerified ? <p className="mt-2 text-xs text-slate-500">Enter the email OTP in the secure MSG91 window to complete verification.</p> : null}</Field>
        <div className="hidden sm:block" />
        <Field label="State" required><Input autoComplete="address-level1" value={form.state} onChange={(e) => update("state", e.target.value)} placeholder="e.g. Uttar Pradesh" /></Field>
        <Field label="City" required><Input autoComplete="address-level2" value={form.city} onChange={(e) => update("city", e.target.value)} placeholder="e.g. Greater Noida" /></Field>
        <Field label="Residential address" required><Input autoComplete="street-address" value={form.residentialAddress} onChange={(e) => update("residentialAddress", e.target.value)} placeholder="House / building, area and landmark" /></Field>
        <Field label="PIN code" required><Input inputMode="numeric" maxLength={6} value={form.pinCode} onChange={(e) => update("pinCode", e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="201009" /></Field>
      </div>
      <SafetyNote />
    </div>
  );
}

function IncomeStep({ form, update }: StepProps) {
  return <div><StepTitle title="Tell us how you earn" description="Choose the option that best describes your income. No document upload is required now." /><div className="mt-7 grid gap-5 sm:grid-cols-2"><Field label="Employment type" required><Select value={form.employmentType} onChange={(e) => update("employmentType", e.target.value)}><option value="">Choose one</option><option value="SALARIED">I receive a monthly salary</option><option value="SELF_EMPLOYED">I am self-employed / a professional</option><option value="BUSINESS_OWNER">I run a shop or business</option><option value="FREELANCER">I do freelance or gig work</option><option value="OTHER">I earn from another source</option></Select></Field><Field label="Company, shop or business name" required><Input value={form.employerOrBusinessName} onChange={(e) => update("employerOrBusinessName", e.target.value)} placeholder="Enter name; use Self if not applicable" /></Field><Field label="Work location" required><Input value={form.officeAddress} onChange={(e) => update("officeAddress", e.target.value)} placeholder="Office, shop or usual work area" /></Field><Field label="Monthly net income" required><Select value={form.monthlyIncomeRange} onChange={(e) => update("monthlyIncomeRange", e.target.value)}><option value="">Choose an income range</option><option value="BELOW_15000">Below ₹15,000</option><option value="15000_24999">₹15,000–₹24,999</option><option value="25000_39999">₹25,000–₹39,999</option><option value="40000_59999">₹40,000–₹59,999</option><option value="60000_99999">₹60,000–₹99,999</option><option value="100000_149999">₹1,00,000–₹1,49,999</option><option value="150000_PLUS">₹1,50,000+</option></Select></Field><Field label="Annual income" required><Input className="number-field" type="number" min={0} value={form.annualIncome} onChange={(e) => update("annualIncome", e.target.value)} placeholder="e.g. 800000" /></Field><Field label="How long have you been earning? (months)" required><Input className="number-field" type="number" min={0} max={600} value={form.durationMonths} onChange={(e) => update("durationMonths", e.target.value)} placeholder="e.g. 24" /></Field></div><div className="mt-7 grid gap-5 sm:grid-cols-2"><YesNo label="Is your salary credited to a bank account?" field="salaryBankCredit" value={form.salaryBankCredit} update={update} /><YesNo label="Do you have an ITR?" field="itrAvailable" value={form.itrAvailable} update={update} /><YesNo label="Do you have GST registration or returns?" field="gstAvailable" value={form.gstAvailable} update={update} /><YesNo label="Do you have Udyam registration?" field="udyamAvailable" value={form.udyamAvailable} update={update} /><YesNo label="Do you have a 6-month bank statement?" field="sixMonthBankStatement" value={form.sixMonthBankStatement} update={update} /></div></div>;
}

function ObligationStep({ form, update }: StepProps) {
  return <div><StepTitle title="Your CIBIL and existing loans" description="A close estimate is enough. This helps us show more relevant loan directions." /><div className="mt-7 grid gap-5 sm:grid-cols-3"><Field label="Total existing monthly EMI"><Input className="number-field" type="number" min={0} value={form.existingEmi} onChange={(e) => update("existingEmi", e.target.value)} /></Field><Field label="Number of active loans"><Input className="number-field" type="number" min={0} max={100} value={form.activeLoans} onChange={(e) => update("activeLoans", e.target.value)} /></Field><Field label="Credit-card outstanding"><Input className="number-field" type="number" min={0} value={form.cardOutstanding} onChange={(e) => update("cardOutstanding", e.target.value)} /></Field></div><div className="mt-7 grid gap-5 sm:grid-cols-2"><YesNo label="Do you currently have any overdue payment?" field="currentOverdue" value={form.currentOverdue} update={update} /><YesNo label="Has any account been settled or written off?" field="settledOrWrittenOff" value={form.settledOrWrittenOff} update={update} /></div><div className="mt-7"><Field label="Your estimated CIBIL score range" required hint="Choose “I don’t know” if you have not checked an official bureau report."><Select value={form.creditRange} onChange={(e) => update("creditRange", e.target.value)}><option value="">Choose your CIBIL range</option><option value="BELOW_550">Below 550</option><option value="550_599">550–599</option><option value="600_649">600–649</option><option value="650_699">650–699</option><option value="700_749">700–749</option><option value="750_PLUS">750+</option><option value="UNKNOWN">I don’t know</option></Select></Field></div></div>;
}

function DocumentStep({ form, update }: StepProps) {
  return <div><StepTitle title="Document readiness" description="Only confirm availability. Do not upload any document yet." /><div className="mt-7 grid gap-5 sm:grid-cols-2"><YesNo label="Do you have a PAN card?" field="panAvailable" value={form.panAvailable} update={update} /><YesNo label="Do you have Aadhaar?" field="aadhaarAvailable" value={form.aadhaarAvailable} update={update} /><YesNo label="Do you have address proof?" field="addressProofAvailable" value={form.addressProofAvailable} update={update} /><YesNo label="Do you have income proof?" field="incomeProofAvailable" value={form.incomeProofAvailable} update={update} /><YesNo label="Do you have a bank statement?" field="bankStatementAvailable" value={form.bankStatementAvailable} update={update} /><YesNo label="Do you have business-registration documents?" field="businessRegistrationAvailable" value={form.businessRegistrationAvailable} update={update} /><YesNo label="Do you have property or gold for a secured loan?" field="securedAssetAvailable" value={form.securedAssetAvailable} update={update} /></div><SafetyNote /></div>;
}

function ConsentStep({ form, update }: StepProps) {
  return <div><StepTitle title="Consent and contact preferences" description="Service consent is required. Marketing consent is optional and is not preselected." /><div className="mt-7 grid gap-4"><label className={cn("flex cursor-pointer items-start gap-4 rounded-2xl border p-5 transition", form.serviceConsent ? "border-brand-600 bg-brand-100/60" : "border-line bg-white")}><input className="mt-1 h-5 w-5 shrink-0 accent-brand-600" type="checkbox" checked={form.serviceConsent} onChange={(e) => update("serviceConsent", e.target.checked)} /><span><span className="block text-sm font-bold text-navy-950">Required service consent</span><span className="mt-2 block text-sm leading-7 text-slate-600">{SERVICE_CONSENT_TEXT}</span></span></label><label className={cn("flex cursor-pointer items-start gap-4 rounded-2xl border p-5 transition", form.marketingConsent ? "border-brand-600 bg-brand-100/60" : "border-line bg-white")}><input className="mt-1 h-5 w-5 shrink-0 accent-brand-600" type="checkbox" checked={form.marketingConsent} onChange={(e) => update("marketingConsent", e.target.checked)} /><span><span className="block text-sm font-bold text-navy-950">Optional marketing consent</span><span className="mt-2 block text-sm leading-7 text-slate-600">{MARKETING_CONSENT_TEXT}</span></span></label></div><div className="mt-6 flex items-start gap-3 rounded-2xl bg-surface p-5 text-sm leading-7 text-slate-600"><MessageSquareText className="mt-1 shrink-0 text-brand-700" size={19} />Promotional messages will be sent only after separate marketing consent. You can opt out at any time.</div></div>;
}

function YesNo<K extends keyof FormState>({ label, field, value, update }: { label: string; field: K; value: boolean | null; update: StepProps["update"] }) {
  return <Field label={label} required><div className="grid grid-cols-2 gap-2"><Choice name={String(field)} value="yes" label="Yes" checked={value === true} onChange={() => update(field, true as FormState[K])} /><Choice name={String(field)} value="no" label="No" checked={value === false} onChange={() => update(field, false as FormState[K])} /></div></Field>;
}

function StepTitle({ title, description }: { title: string; description: string }) { return <div><h2 className="text-2xl font-extrabold tracking-[-0.035em] text-navy-950 sm:text-3xl">{title}</h2><p className="mt-3 text-sm leading-7 text-slate-600">{description}</p></div>; }
function SafetyNote() { return <div className="mt-7 flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-100/50 p-5 text-sm leading-7 text-brand-700"><LockKeyhole className="mt-1 shrink-0" size={18} />Never share a UPI PIN, CVV, net-banking password, Aadhaar OTP or banking credentials.</div>; }
