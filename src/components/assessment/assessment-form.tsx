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
  fullName: string; mobile: string; state: string; city: string; loanAmount: string; loanPurpose: string; loanType: string;
  employmentType: string; monthlyIncomeRange: string; durationMonths: string; salaryBankCredit: boolean | null; itrAvailable: boolean | null; gstAvailable: boolean | null; udyamAvailable: boolean | null; sixMonthBankStatement: boolean | null;
  existingEmi: string; activeLoans: string; cardOutstanding: string; currentOverdue: boolean | null; settledOrWrittenOff: boolean | null; creditRange: string;
  panAvailable: boolean | null; aadhaarAvailable: boolean | null; addressProofAvailable: boolean | null; incomeProofAvailable: boolean | null; bankStatementAvailable: boolean | null; businessRegistrationAvailable: boolean | null; securedAssetAvailable: boolean | null;
  serviceConsent: boolean; marketingConsent: boolean;
};

const initialState: FormState = {
  fullName: "", mobile: "", state: "", city: "", loanAmount: "", loanPurpose: "", loanType: "",
  employmentType: "", monthlyIncomeRange: "", durationMonths: "", salaryBankCredit: null, itrAvailable: null, gstAvailable: null, udyamAvailable: null, sixMonthBankStatement: null,
  existingEmi: "0", activeLoans: "0", cardOutstanding: "0", currentOverdue: null, settledOrWrittenOff: null, creditRange: "",
  panAvailable: null, aadhaarAvailable: null, addressProofAvailable: null, incomeProofAvailable: null, bankStatementAvailable: null, businessRegistrationAvailable: null, securedAssetAvailable: null,
  serviceConsent: false, marketingConsent: false,
};

const steps = ["Basic profile", "Income profile", "Obligations", "Documents", "Consent"];
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
    if (key === "mobile") { setOtpVerified(false); setOtpToken(""); setOtpStarted(false); }
  }

  async function requestOtp() {
    if (form.fullName.trim().length < 2 || !/^[6-9]\\d{9}$/.test(form.mobile)) {
      setError("पहले valid full name और 10-digit mobile number enter करें.");
      return;
    }

    setBusy(true);
    setError("");
    setOtpStarted(true);

    const completeVerification = async (widgetResponse: unknown) => {
      try {
        const accessToken = getMsg91AccessToken(widgetResponse);
        if (!accessToken) throw new Error("MSG91 verification token नहीं मिला. दोबारा कोशिश करें.");
        const response = await fetch("/api/otp/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ fullName: form.fullName, mobile: form.mobile, source, accessToken }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to verify mobile.");
        setOtpVerified(true);
        setOtpToken(data.verificationToken);
        trackEvent("mobile_verified");
      } catch (err) {
        setOtpStarted(false);
        setError(err instanceof Error ? err.message : "Unable to verify mobile.");
      } finally {
        setBusy(false);
      }
    };

    const failVerification = (reason: unknown) => {
      console.error("msg91_widget_failed", reason);
      setOtpStarted(false);
      setBusy(false);
      setError("OTP verification पूरी नहीं हुई. कृपया दोबारा कोशिश करें.");
    };

    const configuration = {
      widgetId: MSG91_WIDGET_ID,
      tokenAuth: MSG91_WIDGET_TOKEN,
      identifier: `91${form.mobile}`,
      exposeMethods: false,
      success: completeVerification,
      failure: failVerification,
    };

    const widgetWindow = window as Window & { initSendOTP?: (config: typeof configuration) => void };
    const launch = () => {
      if (typeof widgetWindow.initSendOTP !== "function") throw new Error("MSG91 OTP service load नहीं हुई.");
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
    if (step === 1 && (!form.fullName || !form.state || !form.city || !form.loanAmount || !form.loanPurpose || !form.loanType || !otpVerified)) return "सभी basic details भरें और mobile verify करें.";
    if (step === 2 && (!form.employmentType || !form.monthlyIncomeRange || form.durationMonths === "" || [form.salaryBankCredit, form.itrAvailable, form.gstAvailable, form.udyamAvailable, form.sixMonthBankStatement].some((v) => v === null))) return "Income profile के सभी questions answer करें.";
    if (step === 3 && (form.existingEmi === "" || form.activeLoans === "" || form.cardOutstanding === "" || form.currentOverdue === null || form.settledOrWrittenOff === null || !form.creditRange)) return "Current obligations के सभी questions answer करें.";
    if (step === 4 && [form.panAvailable, form.aadhaarAvailable, form.addressProofAvailable, form.incomeProofAvailable, form.bankStatementAvailable, form.businessRegistrationAvailable, form.securedAssetAvailable].some((v) => v === null)) return "Document availability के सभी questions answer करें.";
    if (step === 5 && !form.serviceConsent) return "Requested assessment generate करने के लिए service consent required है.";
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
      loanAmount: Number(form.loanAmount), durationMonths: Number(form.durationMonths), existingEmi: Number(form.existingEmi), activeLoans: Number(form.activeLoans), cardOutstanding: Number(form.cardOutstanding),
      otpVerificationToken: otpToken, source, referralCode,
      utm: Object.fromEntries(["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].map((key) => [key, searchParams.get(key)]).filter((entry): entry is [string, string] => Boolean(entry[1]))),
    };
    try {
      const response = await fetch("/api/assessments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to complete assessment.");
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
        {step === 1 ? <BasicStep form={form} update={update} otpStarted={otpStarted} otpVerified={otpVerified} busy={busy} requestOtp={requestOtp} /> : null}
        {step === 2 ? <IncomeStep form={form} update={update} /> : null}
        {step === 3 ? <ObligationStep form={form} update={update} /> : null}
        {step === 4 ? <DocumentStep form={form} update={update} /> : null}
        {step === 5 ? <ConsentStep form={form} update={update} /> : null}
        {error ? <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium leading-6 text-red-800" role="alert">{error}</div> : null}
        <div className="mt-9 flex items-center justify-between gap-3 border-t border-line pt-7">
          <Button type="button" variant="ghost" disabled={step === 1 || busy} onClick={() => setStep((value) => value - 1)}><ArrowLeft size={18} />Back</Button>
          {step < 5 ? <Button type="button" disabled={busy} onClick={next}>Continue <ArrowRight size={18} /></Button> : <Button type="button" disabled={busy} onClick={submit}>{busy ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}Generate free result</Button>}
        </div>
      </div>
    </div>
  );
}

type StepProps = { form: FormState; update: <K extends keyof FormState>(key: K, value: FormState[K]) => void };

function BasicStep({ form, update, otpStarted, otpVerified, busy, requestOtp }: StepProps & { otpStarted: boolean; otpVerified: boolean; busy: boolean; requestOtp: () => void }) {
  return <div><StepTitle title="Basic profile और mobile verification" description="Result link इसी verified WhatsApp number से जुड़ा होगा." /><div className="mt-7 grid gap-5 sm:grid-cols-2"><Field label="Full name" required><Input autoComplete="name" value={form.fullName} onChange={(e) => update("fullName", e.target.value)} placeholder="Your full name" /></Field><Field label="WhatsApp mobile number" required hint="Indian 10-digit mobile number"><div className="flex gap-2"><Input className="number-field" inputMode="numeric" autoComplete="tel" maxLength={10} value={form.mobile} disabled={otpVerified} onChange={(e) => update("mobile", e.target.value.replace(/\\D/g, "").slice(0, 10))} placeholder="98XXXXXXXX" />{!otpVerified ? <Button type="button" variant="secondary" className="shrink-0" disabled={busy} onClick={requestOtp}>{busy ? <Loader2 className="animate-spin" size={17} /> : null}{otpStarted ? "Retry OTP" : "Verify by SMS"}</Button> : <span className="grid min-w-12 place-items-center rounded-xl bg-brand-100 text-brand-700"><Check size={19} /></span>}</div>{otpStarted && !otpVerified ? <p className="mt-2 text-xs text-slate-500">Secure MSG91 window में SMS OTP enter करके verification complete करें.</p> : null}</Field><Field label="State" required><Input autoComplete="address-level1" value={form.state} onChange={(e) => update("state", e.target.value)} placeholder="e.g. Haryana" /></Field><Field label="City" required><Input autoComplete="address-level2" value={form.city} onChange={(e) => update("city", e.target.value)} placeholder="e.g. Gurugram" /></Field><Field label="Required loan amount" required hint="₹50,000 to ₹15,00,000"><Input className="number-field" type="number" inputMode="numeric" min={50000} max={1500000} step={10000} value={form.loanAmount} onChange={(e) => update("loanAmount", e.target.value)} placeholder="500000" /></Field><Field label="Loan purpose" required><Input value={form.loanPurpose} onChange={(e) => update("loanPurpose", e.target.value)} placeholder="e.g. business expansion" /></Field><Field label="Loan type" required><Select value={form.loanType} onChange={(e) => update("loanType", e.target.value)}><option value="">Select category</option><option value="PERSONAL">Personal Loan</option><option value="BUSINESS">Business Loan</option><option value="MSME">MSME Loan</option><option value="MUDRA_GUIDANCE">Mudra Loan Guidance</option><option value="GOLD">Gold Loan</option><option value="PROPERTY">Loan Against Property</option><option value="CREDIT_HEALTH">Credit Health Support</option></Select></Field></div><SafetyNote /></div>;
}

function IncomeStep({ form, update }: StepProps) {
  return <div><StepTitle title="Income profile" description="Exact payslip या bank statement upload अभी required नहीं है." /><div className="mt-7 grid gap-5 sm:grid-cols-2"><Field label="Employment type" required><Select value={form.employmentType} onChange={(e) => update("employmentType", e.target.value)}><option value="">Select one</option><option value="SALARIED">Salaried</option><option value="SELF_EMPLOYED">Self-employed</option><option value="BUSINESS_OWNER">Business owner</option><option value="FREELANCER">Freelancer</option><option value="OTHER">Other</option></Select></Field><Field label="Monthly net income range" required><Select value={form.monthlyIncomeRange} onChange={(e) => update("monthlyIncomeRange", e.target.value)}><option value="">Select range</option><option value="BELOW_15000">Below ₹15,000</option><option value="15000_24999">₹15,000–₹24,999</option><option value="25000_39999">₹25,000–₹39,999</option><option value="40000_59999">₹40,000–₹59,999</option><option value="60000_99999">₹60,000–₹99,999</option><option value="100000_149999">₹1,00,000–₹1,49,999</option><option value="150000_PLUS">₹1,50,000+</option></Select></Field><Field label="Employment/business duration (months)" required><Input className="number-field" type="number" min={0} max={600} value={form.durationMonths} onChange={(e) => update("durationMonths", e.target.value)} placeholder="e.g. 24" /></Field></div><div className="mt-7 grid gap-5 sm:grid-cols-2"><YesNo label="Salary bank credit available?" field="salaryBankCredit" value={form.salaryBankCredit} update={update} /><YesNo label="ITR available?" field="itrAvailable" value={form.itrAvailable} update={update} /><YesNo label="GST registration/returns available?" field="gstAvailable" value={form.gstAvailable} update={update} /><YesNo label="Udyam registration available?" field="udyamAvailable" value={form.udyamAvailable} update={update} /><YesNo label="Six-month bank statement available?" field="sixMonthBankStatement" value={form.sixMonthBankStatement} update={update} /></div></div>;
}

function ObligationStep({ form, update }: StepProps) {
  return <div><StepTitle title="Current obligations और credit profile" description="Approximate values use करें। यह bureau report या lender verification नहीं है." /><div className="mt-7 grid gap-5 sm:grid-cols-3"><Field label="Existing monthly EMIs"><Input className="number-field" type="number" min={0} value={form.existingEmi} onChange={(e) => update("existingEmi", e.target.value)} /></Field><Field label="Number of active loans"><Input className="number-field" type="number" min={0} max={100} value={form.activeLoans} onChange={(e) => update("activeLoans", e.target.value)} /></Field><Field label="Credit-card outstanding"><Input className="number-field" type="number" min={0} value={form.cardOutstanding} onChange={(e) => update("cardOutstanding", e.target.value)} /></Field></div><div className="mt-7 grid gap-5 sm:grid-cols-2"><YesNo label="Any current overdue?" field="currentOverdue" value={form.currentOverdue} update={update} /><YesNo label="Any settled or written-off account?" field="settledOrWrittenOff" value={form.settledOrWrittenOff} update={update} /></div><div className="mt-7"><Field label="Approximate credit-score range" required hint="Choose Do not know if you have not checked an official bureau report."><Select value={form.creditRange} onChange={(e) => update("creditRange", e.target.value)}><option value="">Select range</option><option value="BELOW_550">Below 550</option><option value="550_599">550–599</option><option value="600_649">600–649</option><option value="650_699">650–699</option><option value="700_749">700–749</option><option value="750_PLUS">750+</option><option value="UNKNOWN">Do not know</option></Select></Field></div></div>;
}

function DocumentStep({ form, update }: StepProps) {
  return <div><StepTitle title="Document readiness" description="केवल availability बताएं—कोई document upload न करें." /><div className="mt-7 grid gap-5 sm:grid-cols-2"><YesNo label="PAN available?" field="panAvailable" value={form.panAvailable} update={update} /><YesNo label="Aadhaar available?" field="aadhaarAvailable" value={form.aadhaarAvailable} update={update} /><YesNo label="Address proof available?" field="addressProofAvailable" value={form.addressProofAvailable} update={update} /><YesNo label="Income proof available?" field="incomeProofAvailable" value={form.incomeProofAvailable} update={update} /><YesNo label="Bank statement available?" field="bankStatementAvailable" value={form.bankStatementAvailable} update={update} /><YesNo label="Business registration documents available?" field="businessRegistrationAvailable" value={form.businessRegistrationAvailable} update={update} /><YesNo label="Property or gold available for a secured category?" field="securedAssetAvailable" value={form.securedAssetAvailable} update={update} /></div><SafetyNote /></div>;
}

function ConsentStep({ form, update }: StepProps) {
  return <div><StepTitle title="Consent और communication preferences" description="दोनों choices अलग हैं। Marketing consent optional है और पहले से selected नहीं है." /><div className="mt-7 grid gap-4"><label className={cn("flex cursor-pointer items-start gap-4 rounded-2xl border p-5 transition", form.serviceConsent ? "border-brand-600 bg-brand-100/60" : "border-line bg-white")}><input className="mt-1 h-5 w-5 shrink-0 accent-brand-600" type="checkbox" checked={form.serviceConsent} onChange={(e) => update("serviceConsent", e.target.checked)} /><span><span className="block text-sm font-bold text-navy-950">Mandatory service consent</span><span className="mt-2 block text-sm leading-7 text-slate-600">{SERVICE_CONSENT_TEXT}</span></span></label><label className={cn("flex cursor-pointer items-start gap-4 rounded-2xl border p-5 transition", form.marketingConsent ? "border-brand-600 bg-brand-100/60" : "border-line bg-white")}><input className="mt-1 h-5 w-5 shrink-0 accent-brand-600" type="checkbox" checked={form.marketingConsent} onChange={(e) => update("marketingConsent", e.target.checked)} /><span><span className="block text-sm font-bold text-navy-950">Optional marketing consent</span><span className="mt-2 block text-sm leading-7 text-slate-600">{MARKETING_CONSENT_TEXT}</span></span></label></div><div className="mt-6 flex items-start gap-3 rounded-2xl bg-surface p-5 text-sm leading-7 text-slate-600"><MessageSquareText className="mt-1 shrink-0 text-brand-700" size={19} />Promotional messages केवल valid optional marketing consent के साथ भेजे जाएंगे। STOP भेजकर इसे कभी भी withdraw कर सकते हैं.</div></div>;
}

function YesNo<K extends keyof FormState>({ label, field, value, update }: { label: string; field: K; value: boolean | null; update: StepProps["update"] }) {
  return <Field label={label} required><div className="grid grid-cols-2 gap-2"><Choice name={String(field)} value="yes" label="Yes" checked={value === true} onChange={() => update(field, true as FormState[K])} /><Choice name={String(field)} value="no" label="No" checked={value === false} onChange={() => update(field, false as FormState[K])} /></div></Field>;
}

function StepTitle({ title, description }: { title: string; description: string }) { return <div><h2 className="text-2xl font-extrabold tracking-[-0.035em] text-navy-950 sm:text-3xl">{title}</h2><p className="mt-3 text-sm leading-7 text-slate-600">{description}</p></div>; }
function SafetyNote() { return <div className="mt-7 flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-100/50 p-5 text-sm leading-7 text-brand-700"><LockKeyhole className="mt-1 shrink-0" size={18} />Never share UPI PIN, CVV, net-banking password, Aadhaar OTP or banking credentials.</div>; }
