"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
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
import { isIndividualPan, isValidPanFormat, normalizePan } from "@/lib/domain/identity";

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

function resultHref(assessmentId: string, accessToken: string) {
  return `/result/${assessmentId}?token=${encodeURIComponent(accessToken)}`;
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
  const [result, setResult] = useState<QuickApplyResultSnapshot | null>(null);
  const [paid, setPaid] = useState(false);
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
    const draft = readDraft();
    const amountParam = Number(searchParams.get("amount") || "");
    const purposeParam = searchParams.get("purpose") || "";
    const paidParam = searchParams.get("paid") === "1";
    const assessmentParam = searchParams.get("assessment") || "";
    const tokenParam = searchParams.get("token") || "";
    let leavingForResult = false;

    if (draft) {
      setForm({
        ...draft.form,
        loanAmount: Number.isFinite(amountParam) && amountParam > 0 ? amountParam : draft.form.loanAmount,
        loanPurpose: purposeParam || draft.form.loanPurpose,
      });
    } else if (Number.isFinite(amountParam) && amountParam > 0) {
      setForm((prev) => ({ ...prev, loanAmount: amountParam, loanPurpose: purposeParam || prev.loanPurpose }));
    }

    if (assessmentParam && tokenParam) {
      const completed = snapshot?.status === "COMPLETED" && snapshot.assessmentId === assessmentParam && Boolean(snapshot.indicative);
      if (completed) {
        leavingForResult = true;
        window.location.replace(resultHref(assessmentParam, tokenParam));
      } else {
        const resume: QuickApplyResultSnapshot = {
          assessmentId: assessmentParam,
          accessToken: tokenParam,
          loanAmount: Number.isFinite(amountParam) && amountParam > 0 ? amountParam : draft?.form.loanAmount || 50_000,
          paid: paidParam || snapshot?.paid,
          status: "STARTED",
          indicative: snapshot?.indicative,
        };
        setResult(resume);
        writeResultSnapshot(resume);
        setPaid(Boolean(resume.paid));
        // Legacy early checkout can return here before the profile is finished.
        setStep(3);
      }
    } else if (snapshot?.status === "COMPLETED" && snapshot.indicative) {
      leavingForResult = true;
      window.location.replace(resultHref(snapshot.assessmentId, snapshot.accessToken));
    } else if (snapshot?.assessmentId) {
      setResult(snapshot);
      setPaid(Boolean(snapshot.paid));
      setStep(Math.min(Math.max(draft?.step || 3, 3), 4));
    } else if (draft) {
      setStep(Math.min(4, Math.max(1, draft.step)));
    }
    if (!leavingForResult) trackEvent("assessment_started", { source: "quick_apply" });
  }, [searchParams]);

  useEffect(() => {
    if (step >= 4 && submitted.current) return;
    setSaved(false);
    const timer = window.setTimeout(() => {
      writeDraft(step, form, otpVerified);
      setSaved(true);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [step, form, otpVerified]);

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
      await createDraftAndContinue(data.verificationToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify email.");
    } finally {
      setBusy(false);
    }
  }

  async function createDraftAndContinue(verificationToken: string) {
    const draftResponse = await fetch("/api/assessments/draft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        otpVerificationToken: verificationToken,
        fullName: form.fullName.trim(),
        mobile: form.mobile,
        email: form.email.trim().toLowerCase(),
        loanAmount: form.loanAmount,
        loanPurpose: form.loanPurpose,
        loanType: loanTypeFromPurpose(form.loanPurpose),
        source,
        referralCode: referralCode || undefined,
        utm: attribution,
      }),
    });
    const draftData = (await draftResponse.json()) as SubmitResponse & { status?: string };
    if (!draftResponse.ok) throw new Error(draftData.error || "Could not continue your profile.");
    if (!draftData.assessmentId || !draftData.accessToken) throw new Error("Profile access is missing. Please try again.");
    const snapshot: QuickApplyResultSnapshot = {
      assessmentId: draftData.assessmentId,
      accessToken: draftData.accessToken,
      loanAmount: form.loanAmount,
      paid: false,
      status: "STARTED",
    };
    setResult(snapshot);
    writeResultSnapshot(snapshot);
    goToStep(3);
  }

  async function goNext() {
    setAttempted(true);

    if (step === 2) {
      await verifyOtpAndContinue();
      return;
    }

    const issue = validateQuickApplyStep(step, form);
    if (issue) {
      setError("Please fix the highlighted fields.");
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

    if (step === 4) {
      await submitAssessment();
      return;
    }

    goToStep(getNextQuickApplyStep(step));
  }

  function goBack() {
    setError("");
    setAttempted(false);
    goToStep(getPreviousQuickApplyStep(step));
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
      otpVerificationToken: otpToken || undefined,
      draftAssessmentId: result?.assessmentId,
      resultToken: result?.accessToken,
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
    const issue = validateQuickApplyStep(4, form);
    if (issue) {
      setError(issue);
      return;
    }
    if (!otpToken && !result?.accessToken) {
      setError("Complete email OTP verification again.");
      goToStep(2);
      return;
    }
    if (submitted.current && result?.assessmentId && result.accessToken) {
      window.location.assign(resultHref(result.assessmentId, result.accessToken));
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
        paid,
        status: "COMPLETED",
        indicative: data.indicative || {
          readinessScore: 50,
          readinessLabel: "Moderate readiness",
          disclaimer: "Indicative eligibility estimate, not a loan approval.",
        },
      };
      submitted.current = true;
      writeResultSnapshot(snapshot);
      setResult(snapshot);
      window.location.assign(data.resultUrl || resultHref(data.assessmentId, data.accessToken));
      return;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assessment submission failed.");
    } finally {
      setBusy(false);
    }
  }

  const fieldErrors =
    attempted && step <= 4
      ? {
          ...validateQuickApplyStepFields(step, form),
          ...(step === 2 && otpCode.length !== 6 ? { otpCode: "Enter the 6-digit verification code." } : {}),
        }
      : {};

  const ctaLabel =
    step === 1
      ? "Send email code"
      : step === 2
        ? "Verify and continue"
        : step === 4
          ? "See my result"
          : "Continue";

  return (
    <div className="min-h-screen bg-surface">
      <FunnelHeader step={step} saved={saved} phase="form" />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:py-10">
        <div>
          <MobileTrustStrip />
          <div className="mt-4 rounded-[1.75rem] border border-line bg-white p-5 shadow-soft sm:p-8">
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
            <StickyActions error={error}>
              {step > 1 ? (
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
