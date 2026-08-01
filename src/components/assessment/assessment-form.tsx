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
  fullName: string; mobile: string; email: string; state: string; city: string; loanAmount: string; loanPurpose: string; loanType: string;
  employmentType: string; monthlyIncomeRange: string; durationMonths: string; salaryBankCredit: boolean | null; itrAvailable: boolean | null; gstAvailable: boolean | null; udyamAvailable: boolean | null; sixMonthBankStatement: boolean | null;
  existingEmi: string; activeLoans: string; cardOutstanding: string; currentOverdue: boolean | null; settledOrWrittenOff: boolean | null; creditRange: string;
  panAvailable: boolean | null; aadhaarAvailable: boolean | null; addressProofAvailable: boolean | null; incomeProofAvailable: boolean | null; bankStatementAvailable: boolean | null; businessRegistrationAvailable: boolean | null; securedAssetAvailable: boolean | null;
  serviceConsent: boolean; marketingConsent: boolean;
};

const initialState: FormState = {
  fullName: "", mobile: "", email: "", state: "", city: "", loanAmount: "", loanPurpose: "", loanType: "",
  employmentType: "", monthlyIncomeRange: "", durationMonths: "", salaryBankCredit: null, itrAvailable: null, gstAvailable: null, udyamAvailable: null, sixMonthBankStatement: null,
  existingEmi: "0", activeLoans: "0", cardOutstanding: "0", currentOverdue: null, settledOrWrittenOff: null, creditRange: "",
  panAvailable: null, aadhaarAvailable: null, addressProofAvailable: null, incomeProofAvailable: null, bankStatementAvailable: null, businessRegistrationAvailable: null, securedAssetAvailable: null,
  serviceConsent: false, marketingConsent: false,
};

const steps = ["बुनियादी जानकारी", "आय की जानकारी", "मौजूदा EMI", "Documents", "सहमति"];
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
    if (key === "mobile" || key === "email") { setOtpVerified(false); setOtpToken(""); setOtpStarted(false); }
  }

  async function requestOtp() {
    if (form.fullName.trim().length < 2 || !/^[6-9]\d{9}$/.test(form.mobile) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError("सही नाम, 10 अंकों का mobile number और email address भरें।");
      return;
    }

    setBusy(true);
    setError("");
    setOtpStarted(true);

    const completeVerification = async (widgetResponse: unknown) => {
      try {
        const accessToken = getMsg91AccessToken(widgetResponse);
        if (!accessToken) throw new Error("MSG91 verification token नहीं मिला। कृपया दोबारा कोशिश करें।");
        const response = await fetch("/api/otp/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ fullName: form.fullName, mobile: form.mobile, email: form.email, source, accessToken }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Email verify नहीं हो सकी।");
        setOtpVerified(true);
        setOtpToken(data.verificationToken);
        trackEvent("email_verified");
      } catch (err) {
        setOtpStarted(false);
        setError(err instanceof Error ? err.message : "Email verify नहीं हो सकी।");
      } finally {
        setBusy(false);
      }
    };

    const failVerification = (reason: unknown) => {
      console.error("msg91_widget_failed", reason);
      setOtpStarted(false);
      setBusy(false);
      setError("OTP verification पूरी नहीं हुई। कृपया दोबारा कोशिश करें।");
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
      if (typeof widgetWindow.initSendOTP !== "function") throw new Error("MSG91 OTP service शुरू नहीं हुई।");
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
    if (step === 1 && (!form.fullName || !form.state || !form.city || !form.loanAmount || !form.loanPurpose || !form.loanType || !otpVerified)) return "सभी बुनियादी जानकारी भरें और email verify करें।";
    if (step === 2 && (!form.employmentType || !form.monthlyIncomeRange || form.durationMonths === "" || [form.salaryBankCredit, form.itrAvailable, form.gstAvailable, form.udyamAvailable, form.sixMonthBankStatement].some((v) => v === null))) return "आय से जुड़े सभी सवालों के जवाब दें।";
    if (step === 3 && (form.existingEmi === "" || form.activeLoans === "" || form.cardOutstanding === "" || form.currentOverdue === null || form.settledOrWrittenOff === null || !form.creditRange)) return "मौजूदा EMI और देनदारियों के सभी सवालों के जवाब दें।";
    if (step === 4 && [form.panAvailable, form.aadhaarAvailable, form.addressProofAvailable, form.incomeProofAvailable, form.bankStatementAvailable, form.businessRegistrationAvailable, form.securedAssetAvailable].some((v) => v === null)) return "Documents से जुड़े सभी सवालों के जवाब दें।";
    if (step === 5 && !form.serviceConsent) return "Result तैयार करने के लिए service consent जरूरी है।";
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
        <div className="flex items-center justify-between text-xs font-bold text-slate-300"><span>चरण {step} / 5</span><span className="text-brand-100">{steps[step - 1]}</span></div>
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
          <Button type="button" variant="ghost" disabled={step === 1 || busy} onClick={() => setStep((value) => value - 1)}><ArrowLeft size={18} />वापस</Button>
          {step < 5 ? <Button type="button" disabled={busy} onClick={next}>आगे बढ़ें <ArrowRight size={18} /></Button> : <Button type="button" disabled={busy} onClick={submit}>{busy ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}मेरा शुरुआती result देखें</Button>}
        </div>
      </div>
    </div>
  );
}

type StepProps = { form: FormState; update: <K extends keyof FormState>(key: K, value: FormState[K]) => void };

function BasicStep({ form, update, otpStarted, otpVerified, busy, requestOtp }: StepProps & { otpStarted: boolean; otpVerified: boolean; busy: boolean; requestOtp: () => void }) {
  return <div><StepTitle title="बुनियादी जानकारी और email verification" description="Mobile number आपकी profile में रहेगा और verification OTP email पर आएगा।" /><div className="mt-7 grid gap-5 sm:grid-cols-2"><Field label="पूरा नाम" required><Input autoComplete="name" value={form.fullName} onChange={(e) => update("fullName", e.target.value)} placeholder="Your full name" /></Field><Field label="WhatsApp mobile number" required hint="भारत का 10 अंकों का mobile number"><Input className="number-field" inputMode="numeric" autoComplete="tel" maxLength={10} value={form.mobile} disabled={otpVerified} onChange={(e) => update("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="98XXXXXXXX" /></Field><Field label="Email address" required hint="OTP इसी email पर आएगा"><div className="flex gap-2"><Input type="email" autoComplete="email" value={form.email} disabled={otpVerified} onChange={(e) => update("email", e.target.value.trim())} placeholder="name@example.com" />{!otpVerified ? <Button type="button" variant="secondary" className="shrink-0" disabled={busy} onClick={requestOtp}>{busy ? <Loader2 className="animate-spin" size={17} /> : null}{otpStarted ? "OTP दोबारा भेजें" : "Email verify करें"}</Button> : <span className="grid min-w-12 place-items-center rounded-xl bg-brand-100 text-brand-700"><Check size={19} /></span>}</div>{otpStarted && !otpVerified ? <p className="mt-2 text-xs text-slate-500">MSG91 की सुरक्षित window में email OTP भरकर verification पूरा करें।</p> : null}</Field><div className="hidden sm:block" /><Field label="राज्य" required><Input autoComplete="address-level1" value={form.state} onChange={(e) => update("state", e.target.value)} placeholder="e.g. Haryana" /></Field><Field label="शहर" required><Input autoComplete="address-level2" value={form.city} onChange={(e) => update("city", e.target.value)} placeholder="e.g. Gurugram" /></Field><Field label="जरूरी loan amount" required hint="₹50,000 to ₹15,00,000"><Input className="number-field" type="number" inputMode="numeric" min={50000} max={1500000} step={10000} value={form.loanAmount} onChange={(e) => update("loanAmount", e.target.value)} placeholder="500000" /></Field><Field label="Loan का उद्देश्य" required><Input value={form.loanPurpose} onChange={(e) => update("loanPurpose", e.target.value)} placeholder="e.g. business expansion" /></Field><Field label="Loan की category" required><Select value={form.loanType} onChange={(e) => update("loanType", e.target.value)}><option value="">Category चुनें</option><option value="PERSONAL">Personal Loan</option><option value="BUSINESS">Business Loan</option><option value="MSME">MSME Loan</option><option value="MUDRA_GUIDANCE">Mudra Loan Guidance</option><option value="GOLD">Gold Loan</option><option value="PROPERTY">Loan Against Property</option><option value="CREDIT_HEALTH">Credit Health Support</option></Select></Field></div><SafetyNote /></div>;
}

function IncomeStep({ form, update }: StepProps) {
  return <div><StepTitle title="आय और काम की जानकारी" description="अभी payslip या bank statement upload करने की जरूरत नहीं है।" /><div className="mt-7 grid gap-5 sm:grid-cols-2"><Field label="काम का प्रकार" required><Select value={form.employmentType} onChange={(e) => update("employmentType", e.target.value)}><option value="">एक विकल्प चुनें</option><option value="SALARIED">Salaried</option><option value="SELF_EMPLOYED">Self-employed</option><option value="BUSINESS_OWNER">Business owner</option><option value="FREELANCER">Freelancer</option><option value="OTHER">Other</option></Select></Field><Field label="मासिक शुद्ध आय" required><Select value={form.monthlyIncomeRange} onChange={(e) => update("monthlyIncomeRange", e.target.value)}><option value="">आय की range चुनें</option><option value="BELOW_15000">Below ₹15,000</option><option value="15000_24999">₹15,000–₹24,999</option><option value="25000_39999">₹25,000–₹39,999</option><option value="40000_59999">₹40,000–₹59,999</option><option value="60000_99999">₹60,000–₹99,999</option><option value="100000_149999">₹1,00,000–₹1,49,999</option><option value="150000_PLUS">₹1,50,000+</option></Select></Field><Field label="नौकरी या business की अवधि (महीने)" required><Input className="number-field" type="number" min={0} max={600} value={form.durationMonths} onChange={(e) => update("durationMonths", e.target.value)} placeholder="e.g. 24" /></Field></div><div className="mt-7 grid gap-5 sm:grid-cols-2"><YesNo label="क्या salary bank account में आती है?" field="salaryBankCredit" value={form.salaryBankCredit} update={update} /><YesNo label="क्या ITR उपलब्ध है?" field="itrAvailable" value={form.itrAvailable} update={update} /><YesNo label="क्या GST registration/returns उपलब्ध हैं?" field="gstAvailable" value={form.gstAvailable} update={update} /><YesNo label="क्या Udyam registration उपलब्ध है?" field="udyamAvailable" value={form.udyamAvailable} update={update} /><YesNo label="क्या 6 महीने की bank statement उपलब्ध है?" field="sixMonthBankStatement" value={form.sixMonthBankStatement} update={update} /></div></div>;
}

function ObligationStep({ form, update }: StepProps) {
  return <div><StepTitle title="मौजूदा EMI और credit profile" description="लगभग सही जानकारी दें। यह credit bureau report या lender verification नहीं है।" /><div className="mt-7 grid gap-5 sm:grid-cols-3"><Field label="कुल मौजूदा मासिक EMI"><Input className="number-field" type="number" min={0} value={form.existingEmi} onChange={(e) => update("existingEmi", e.target.value)} /></Field><Field label="चल रहे loans की संख्या"><Input className="number-field" type="number" min={0} max={100} value={form.activeLoans} onChange={(e) => update("activeLoans", e.target.value)} /></Field><Field label="Credit card का बकाया"><Input className="number-field" type="number" min={0} value={form.cardOutstanding} onChange={(e) => update("cardOutstanding", e.target.value)} /></Field></div><div className="mt-7 grid gap-5 sm:grid-cols-2"><YesNo label="क्या अभी कोई overdue payment है?" field="currentOverdue" value={form.currentOverdue} update={update} /><YesNo label="क्या कोई account settled या written-off है?" field="settledOrWrittenOff" value={form.settledOrWrittenOff} update={update} /></div><div className="mt-7"><Field label="अनुमानित CIBIL score range" required hint="Official bureau report नहीं देखी है तो “अभी पता नहीं” चुनें।"><Select value={form.creditRange} onChange={(e) => update("creditRange", e.target.value)}><option value="">आय की range चुनें</option><option value="BELOW_550">Below 550</option><option value="550_599">550–599</option><option value="600_649">600–649</option><option value="650_699">650–699</option><option value="700_749">700–749</option><option value="750_PLUS">750+</option><option value="UNKNOWN">अभी पता नहीं</option></Select></Field></div></div>;
}

function DocumentStep({ form, update }: StepProps) {
  return <div><StepTitle title="Documents की तैयारी" description="सिर्फ उपलब्धता बताएँ—अभी कोई document upload न करें।" /><div className="mt-7 grid gap-5 sm:grid-cols-2"><YesNo label="क्या PAN उपलब्ध है?" field="panAvailable" value={form.panAvailable} update={update} /><YesNo label="क्या Aadhaar उपलब्ध है?" field="aadhaarAvailable" value={form.aadhaarAvailable} update={update} /><YesNo label="क्या address proof उपलब्ध है?" field="addressProofAvailable" value={form.addressProofAvailable} update={update} /><YesNo label="क्या income proof उपलब्ध है?" field="incomeProofAvailable" value={form.incomeProofAvailable} update={update} /><YesNo label="क्या bank statement उपलब्ध है?" field="bankStatementAvailable" value={form.bankStatementAvailable} update={update} /><YesNo label="क्या business registration documents उपलब्ध हैं?" field="businessRegistrationAvailable" value={form.businessRegistrationAvailable} update={update} /><YesNo label="क्या secured loan के लिए property या gold उपलब्ध है?" field="securedAssetAvailable" value={form.securedAssetAvailable} update={update} /></div><SafetyNote /></div>;
}

function ConsentStep({ form, update }: StepProps) {
  return <div><StepTitle title="सहमति और संपर्क की पसंद" description="Service consent जरूरी है। Marketing consent वैकल्पिक है और पहले से selected नहीं है।" /><div className="mt-7 grid gap-4"><label className={cn("flex cursor-pointer items-start gap-4 rounded-2xl border p-5 transition", form.serviceConsent ? "border-brand-600 bg-brand-100/60" : "border-line bg-white")}><input className="mt-1 h-5 w-5 shrink-0 accent-brand-600" type="checkbox" checked={form.serviceConsent} onChange={(e) => update("serviceConsent", e.target.checked)} /><span><span className="block text-sm font-bold text-navy-950">जरूरी service consent</span><span className="mt-2 block text-sm leading-7 text-slate-600">{SERVICE_CONSENT_TEXT}</span></span></label><label className={cn("flex cursor-pointer items-start gap-4 rounded-2xl border p-5 transition", form.marketingConsent ? "border-brand-600 bg-brand-100/60" : "border-line bg-white")}><input className="mt-1 h-5 w-5 shrink-0 accent-brand-600" type="checkbox" checked={form.marketingConsent} onChange={(e) => update("marketingConsent", e.target.checked)} /><span><span className="block text-sm font-bold text-navy-950">वैकल्पिक marketing consent</span><span className="mt-2 block text-sm leading-7 text-slate-600">{MARKETING_CONSENT_TEXT}</span></span></label></div><div className="mt-6 flex items-start gap-3 rounded-2xl bg-surface p-5 text-sm leading-7 text-slate-600"><MessageSquareText className="mt-1 shrink-0 text-brand-700" size={19} />Promotional messages केवल आपकी अलग marketing consent के बाद भेजे जाएँगे। STOP भेजकर इसे कभी भी बंद कर सकते हैं।</div></div>;
}

function YesNo<K extends keyof FormState>({ label, field, value, update }: { label: string; field: K; value: boolean | null; update: StepProps["update"] }) {
  return <Field label={label} required><div className="grid grid-cols-2 gap-2"><Choice name={String(field)} value="yes" label="हाँ" checked={value === true} onChange={() => update(field, true as FormState[K])} /><Choice name={String(field)} value="no" label="नहीं" checked={value === false} onChange={() => update(field, false as FormState[K])} /></div></Field>;
}

function StepTitle({ title, description }: { title: string; description: string }) { return <div><h2 className="text-2xl font-extrabold tracking-[-0.035em] text-navy-950 sm:text-3xl">{title}</h2><p className="mt-3 text-sm leading-7 text-slate-600">{description}</p></div>; }
function SafetyNote() { return <div className="mt-7 flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-100/50 p-5 text-sm leading-7 text-brand-700"><LockKeyhole className="mt-1 shrink-0" size={18} />UPI PIN, CVV, net-banking password, Aadhaar OTP या banking details कभी साझा न करें।</div>; }
