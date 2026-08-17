"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CircleAlert, Loader2, ShieldCheck } from "lucide-react";
import { CreditProfileBoosterPayCard } from "@/components/apply/quick/booster-pay-card";
import { FunnelHeader, FunnelSidebar, MobileTrustStrip, StickyActions } from "@/components/apply/quick/funnel-shell";
import { QuickApplyStepBody } from "@/components/apply/quick/steps";
import { Button } from "@/components/ui/button";
import { captureAttributionFromSearch, getAttributionPayload } from "@/lib/attribution";
import {
  clearDraft,
  defaultQuickApplyForm,
  loanTypeFromPurpose,
  mapEmploymentApi,
  mapIncomeToRange,
  maskEmail,
  readDraft,
  readResultSnapshot,
  writeDraft,
  writeResultSnapshot,
  type QuickApplyFormState,
  type QuickApplyResultSnapshot,
} from "@/lib/apply/quick-apply-state";
import {
  getNextQuickApplyStep,
  getPreviousQuickApplyStep,
  validateQuickApplyStep,
  validateQuickApplyStepFields,
} from "@/lib/apply/quick-apply-validation";
import {
  prepareMsg91EmailOtp,
  resetMsg91EmailOtpClient,
  retryMsg91EmailOtp,
  sendMsg91EmailOtp,
  verifyMsg91EmailOtp,
} from "@/lib/apply/msg91-email-otp";
import { trackEvent } from "@/lib/analytics-client";
import { RESULT_DISCLAIMER, USP_PRODUCT_SLUG } from "@/lib/constants";
import { isIndividualPan, isValidPanFormat, normalizePan } from "@/lib/domain/identity";
import { formatInr } from "@/lib/utils";

const MSG91_WIDGET_ID = process.env.NEXT_PUBLIC_MSG91_WIDGET_ID ?? "";
const MSG91_WIDGET_TOKEN = process.env.NEXT_PUBLIC_MSG91_WIDGET_TOKEN ?? "";

type IndicativeResult = QuickApplyResultSnapshot["indicative"];

type SubmitResponse = {
  error?: string;
  fields?: Record<string, string[] | undefined>;
  assessmentId?: string;
  accessToken?: string;
  resultUrl?: string;
  indicative?: IndicativeResult;
};

function firstFieldError(fields?: Record<string, string[] | undefined>) {
  if (!fields) return "";
  for (const value of Object.values(fields)) {
    if (value?.[0]) return value[0];
  }
  return "";
}

function checkoutHref(assessmentId: string, accessToken: string) {
  return `/checkout?product=${USP_PRODUCT_SLUG}&assessment=${assessmentId}&token=${encodeURIComponent(accessToken)}`;
}

export function QuickApplyClient() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<QuickApplyFormState>(defaultQuickApplyForm);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(true);
  const [attempted, setAttempted] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpToken, setOtpToken] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpReqId, setOtpReqId] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [otpReady, setOtpReady] = useState(false);
  const [phase, setPhase] = useState<"form" | "result">("form");
  const [result, setResult] = useState<QuickApplyResultSnapshot | null>(null);
  const hydrated = useRef(false);
  const submitted = useRef(false);

  const attribution = useMemo(() => {
    captureAttributionFromSearch(searchParams);
    return getAttributionPayload(searchParams);
  }, [searchParams]);

  const source = attribution.utm_source || searchParams.get("utm_source") || "quick_apply";
  const referralCode = searchParams.get("ref") || attribution.ref || "";

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const snapshot = readResultSnapshot();
    if (snapshot) {
      setResult(snapshot);
      setStep(6);
    }
    const draft = readDraft();
    const amountParam = Number(searchParams.get("amount") || "");
    const purposeParam = searchParams.get("purpose") || "";
    if (draft && !snapshot) {
      setStep(draft.step === 6 ? 5 : draft.step);
      setForm({
        ...draft.form,
        loanAmount: Number.isFinite(amountParam) && amountParam > 0 ? amountParam : draft.form.loanAmount,
        loanPurpose: purposeParam || draft.form.loanPurpose,
      });
    } else if (Number.isFinite(amountParam) && amountParam > 0) {
      setForm((prev) => ({ ...prev, loanAmount: amountParam, loanPurpose: purposeParam || prev.loanPurpose }));
    }
    trackEvent("assessment_started", { source: "quick_apply" });
  }, [searchParams]);

  useEffect(() => {
    if (phase !== "form" || step >= 6) return;
    setSaved(false);
    const timer = window.setTimeout(() => {
      writeDraft(step, form, otpVerified);
      setSaved(true);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [step, form, otpVerified, phase]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  function patch(partial: Partial<QuickApplyFormState>) {
    setForm((prev) => ({ ...prev, ...partial }));
    setError("");
  }

  function goToStep(next: number) {
    setAttempted(false);
    setError("");
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function ensureOtpPrepared() {
    await prepareMsg91EmailOtp(MSG91_WIDGET_ID, MSG91_WIDGET_TOKEN);
    setOtpReady(true);
  }

  async function sendOtp() {
    setBusy(true);
    setError("");
    try {
      await ensureOtpPrepared();
      const sent = await sendMsg91EmailOtp(form.email.trim().toLowerCase());
      setOtpReqId(sent.reqId || "");
      setResendIn(45);
      setOtpCode("");
      setOtpVerified(false);
      setOtpToken("");
      trackEvent("email_otp_sent");
    } catch (err) {
      resetMsg91EmailOtpClient();
      setOtpReady(false);
      setError(err instanceof Error ? err.message : "Could not send verification code.");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function resendOtp() {
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
    } catch (err) {
      resetMsg91EmailOtpClient();
      setOtpReady(false);
      setError(err instanceof Error ? err.message : "Could not resend code.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtpAndContinue() {
    if (otpCode.length !== 6) {
      setAttempted(true);
      setError("Enter the 6-digit verification code.");
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
          fullName: form.fullName.trim(),
          mobile: form.mobile,
          email: form.email.trim().toLowerCase(),
          source,
          accessToken,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "OTP verification failed or expired. Please try again.");
      setOtpVerified(true);
      setOtpToken(data.verificationToken);
      trackEvent("email_verified");
      goToStep(getNextQuickApplyStep(2, form));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify email.");
    } finally {
      setBusy(false);
    }
  }

  async function goNext() {
    setAttempted(true);

    if (step === 2) {
      await verifyOtpAndContinue();
      return;
    }

    if (step === 6) {
      trackEvent("free_result_viewed");
      setPhase("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const issue = validateQuickApplyStep(step, form);
    if (issue) {
      setError(issue);
      return;
    }
    setError("");

    if (step === 1) {
      try {
        await sendOtp();
        goToStep(2);
      } catch {
        /* error already set */
      }
      return;
    }

    if (step === 5) {
      await submitAssessment();
      return;
    }

    goToStep(getNextQuickApplyStep(step, form));
  }

  function goBack() {
    setError("");
    setAttempted(false);
    if (phase === "result") {
      setPhase("form");
      setStep(6);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    goToStep(getPreviousQuickApplyStep(step, form));
  }

  function buildPayload() {
    const monthlyIncome = Number(form.monthlyIncome.replace(/\D/g, "") || "0");
    const monthlyIncomeRange = mapIncomeToRange(monthlyIncome);
    const pan = normalizePan(form.panNumber);
    const panFormatOk = isValidPanFormat(pan) && isIndividualPan(pan);
    const employmentType = mapEmploymentApi(form.employmentUi);
    const years = Number(form.yearsAtAddress) || 0;
    const monthsAtAddress = Math.min(600, Math.max(0, Math.round(years * 12)));
    const pin = form.addressPinCode || form.pinCode;

    return {
      otpVerificationToken: otpToken,
      fullName: form.fullName.trim(),
      mobile: form.mobile,
      email: form.email.trim().toLowerCase(),
      dateOfBirth: form.dateOfBirth,
      state: form.state.trim(),
      city: form.city.trim(),
      residentialAddress: form.residentialAddress.trim(),
      pinCode: pin,
      residenceType: form.residenceType || "OTHER",
      monthsAtAddress,
      loanAmount: form.loanAmount,
      loanPurpose: form.loanPurpose,
      loanType: loanTypeFromPurpose(form.loanPurpose),
      employmentType,
      employerOrBusinessName: form.employerOrBusinessName.trim(),
      officeAddress: form.residentialAddress.trim(),
      monthlyIncomeRange,
      annualIncome: Math.round(monthlyIncome * 12),
      durationMonths: Math.min(480, Math.max(0, Number(form.durationMonths) || 0)),
      salaryBankCredit: form.employmentUi === "SALARIED" ? form.salaryCreditMode === "bank" : false,
      itrAvailable: false,
      gstAvailable: false,
      udyamAvailable: false,
      sixMonthBankStatement: false,
      existingEmi: Math.max(0, Number(form.existingEmi) || 0),
      activeLoans: Math.max(0, Number(form.activeLoans) || 0),
      cardOutstanding: Math.max(0, Number(form.cardOutstanding) || 0),
      currentOverdue: Boolean(form.currentOverdue),
      settledOrWrittenOff: false,
      creditRange: form.creditRange || "UNKNOWN",
      panNumber: pan,
      panFormatValidated: panFormatOk,
      panVerificationStatus: "not_verified" as const,
      panAvailable: panFormatOk,
      aadhaarAvailable: false,
      addressProofAvailable: false,
      incomeProofAvailable: false,
      bankStatementAvailable: false,
      businessRegistrationAvailable: employmentType === "BUSINESS_OWNER",
      securedAssetAvailable: false,
      serviceConsent: true as const,
      marketingConsent: form.marketingConsent,
      source,
      referralCode: referralCode || undefined,
      utm: attribution,
    };
  }

  async function submitAssessment() {
    const issue = validateQuickApplyStep(5, form);
    if (issue) {
      setError(issue);
      return;
    }
    if (!otpToken) {
      setError("Complete email OTP verification again.");
      goToStep(2);
      return;
    }
    if (submitted.current && result) {
      goToStep(6);
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
      const data = (await response.json()) as SubmitResponse;
      if (!response.ok) {
        const fieldMessage = firstFieldError(data.fields);
        throw new Error(fieldMessage || data.error || "We could not save your assessment. Please try again.");
      }
      if (!data.assessmentId || !data.accessToken) throw new Error("Assessment was saved but result access is missing.");
      trackEvent("assessment_completed");
      clearDraft();
      const snapshot: QuickApplyResultSnapshot = {
        assessmentId: data.assessmentId,
        accessToken: data.accessToken,
        loanAmount: form.loanAmount,
        indicative: data.indicative || {
          readinessScore: 50,
          readinessLabel: "Moderate readiness",
          disclaimer: "Indicative eligibility estimate, not a loan approval.",
        },
      };
      submitted.current = true;
      writeResultSnapshot(snapshot);
      setResult(snapshot);
      goToStep(6);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assessment submission failed.");
    } finally {
      setBusy(false);
    }
  }

  const fieldErrors =
    attempted && step < 6
      ? {
          ...validateQuickApplyStepFields(step, form),
          ...(step === 2 && otpCode.length !== 6 ? { otpCode: "Enter the 6-digit verification code." } : {}),
        }
      : {};

  const ctaLabel =
    step === 1 ? "Send email code" : step === 2 ? "Verify and continue" : step === 5 ? "Continue to payment" : step === 6 ? "View my loan options" : "Continue";

  const headerPhase = phase === "result" ? "result" : step === 6 ? "payment" : "form";

  if (phase === "result" && result) {
    const checkoutUrl = checkoutHref(result.assessmentId, result.accessToken);
    const emiMin = result.indicative.comfortableEmiMin;
    const emiMax = result.indicative.comfortableEmiMax;
    return (
      <div className="min-h-screen bg-surface">
        <FunnelHeader step={6} saved phase="result" />
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
          <div className="rounded-[1.75rem] border border-line bg-white p-6 shadow-soft sm:p-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-700">Preliminary result</p>
            <h1 className="font-display mt-3 text-3xl font-extrabold tracking-[-0.045em] text-navy-950 sm:text-4xl">
              Your preliminary loan profile is ready
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              This is not a lender approval and not a bureau score. Final approval, APR, amount and tenure are decided by the lender.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-navy-950 p-5 text-white">
                <p className="text-xs text-slate-300">Readiness band</p>
                <p className="mt-2 text-3xl font-black text-brand-500">{result.indicative.readinessScore}</p>
                <p className="mt-1 text-sm font-bold">{result.indicative.readinessLabel}</p>
              </div>
              <div className="rounded-2xl border border-line bg-surface p-5">
                <p className="text-xs font-semibold text-slate-500">Requested amount</p>
                <p className="mt-2 text-xl font-extrabold text-navy-950">{formatInr(result.loanAmount || form.loanAmount)}</p>
              </div>
              <div className="rounded-2xl border border-line bg-surface p-5">
                <p className="text-xs font-semibold text-slate-500">Estimated affordable EMI</p>
                <p className="mt-2 text-xl font-extrabold text-navy-950">
                  {emiMin != null && emiMax != null ? `${formatInr(emiMin)}–${formatInr(emiMax)}` : "Subject to lender"}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <h2 className="font-extrabold text-navy-950">Positive profile factors</h2>
                <ul className="mt-3 space-y-2">
                  {(result.indicative.strengths || ["Self-reported details received for educational assessment."]).map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                      <Check className="mt-0.5 shrink-0 text-brand-600" size={15} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="font-extrabold text-navy-950">Improvement areas</h2>
                <ul className="mt-3 space-y-2">
                  {(result.indicative.improvements || ["Keep documents ready before applying to any lender."]).slice(0, 5).map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                      <CircleAlert className="mt-0.5 shrink-0 text-amber-600" size={15} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {result.indicative.suitableCategories?.length ? (
              <div className="mt-6">
                <h2 className="font-extrabold text-navy-950">Relevant loan categories</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.indicative.suitableCategories.map((item) => (
                    <span key={item} className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-bold text-slate-700">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-8">
              <CreditProfileBoosterPayCard checkoutUrl={checkoutUrl} compact />
            </div>

            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              <ShieldCheck className="mt-0.5 shrink-0" size={18} />
              <p>{RESULT_DISCLAIMER}</p>
            </div>

            <button type="button" className="mt-6 text-sm font-bold text-brand-700 underline" onClick={goBack}>
              Back to payment
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <FunnelHeader step={step} saved={saved} phase={headerPhase} />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:py-10">
        <div>
          <MobileTrustStrip />
          <div className="mt-4 rounded-[1.75rem] border border-line bg-white p-5 shadow-soft sm:p-8">
            {step === 6 && result ? (
              <div>
                <h1 className="font-display text-3xl font-extrabold tracking-[-0.045em] text-navy-950 sm:text-4xl">
                  Unlock matched loan options
                </h1>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Your profile check is saved. Continue with the existing Credit Profile Booster checkout to see matched official lender links.
                </p>
                <div className="mt-6">
                  <CreditProfileBoosterPayCard checkoutUrl={checkoutHref(result.assessmentId, result.accessToken)} />
                </div>
              </div>
            ) : (
              <QuickApplyStepBody
                form={form}
                patch={patch}
                step={step}
                errors={fieldErrors}
                otp={{
                  code: otpCode,
                  setCode: setOtpCode,
                  maskedEmail: maskEmail(form.email),
                  resendIn,
                  onResend: () => void resendOtp(),
                  onChangeEmail: () => {
                    setOtpVerified(false);
                    setOtpToken("");
                    setOtpCode("");
                    goToStep(1);
                  },
                  sending: busy,
                }}
              />
            )}
            <StickyActions error={error}>
              {step > 1 || phase === "result" ? (
                <Button type="button" variant="secondary" className="min-w-24" onClick={goBack} disabled={busy}>
                  <ArrowLeft size={16} /> Back
                </Button>
              ) : null}
              <Button type="button" className="min-h-[52px] flex-1" onClick={() => void goNext()} disabled={busy} aria-busy={busy}>
                {busy ? <Loader2 className="animate-spin" size={18} /> : null}
                {ctaLabel}
                {!busy ? <ArrowRight size={16} /> : null}
              </Button>
            </StickyActions>
          </div>
        </div>
        <FunnelSidebar step={step} />
      </div>
    </div>
  );
}
