"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { getAttributionPayload } from "@/lib/attribution";
import { hasMarketingConsent } from "@/lib/consent/marketing-consent";
import {
  ENQUIRY_FOLLOW_UP_CONSENT_TEXT,
  INDIAN_STATES_AND_UTS,
  LOAN_ASSISTANCE_TYPES,
} from "@/lib/loan-assistance/constants";
import { emitLoanAssistanceBrowserLead } from "@/lib/loan-assistance/browser-lead";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";

const SUBMISSION_KEY = "vplc_loan_assistance_submission_key";

type FieldKey = "fullName" | "mobile" | "city" | "state" | "loanType" | "followUpConsent";
type FieldErrors = Partial<Record<FieldKey, string>>;
type SuccessState = { status: "created" | "duplicate"; reference: string; isTest: boolean };

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function submissionKey(): string {
  const existing = sessionStorage.getItem(SUBMISSION_KEY);
  if (existing) return existing;
  const next = crypto.randomUUID();
  sessionStorage.setItem(SUBMISSION_KEY, next);
  return next;
}

function rotateSubmissionKey() {
  sessionStorage.setItem(SUBMISSION_KEY, crypto.randomUUID());
}

export function LoanAssistanceEnquiryForm() {
  const consentId = useId();
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [loanType, setLoanType] = useState("");
  const [followUpConsent, setFollowUpConsent] = useState(false);
  const [companyUrl, setCompanyUrl] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<SuccessState | null>(null);

  useEffect(() => {
    submissionKey();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFormError("");
    setErrors({});
    try {
      const response = await fetch("/api/loan-assistance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName,
          mobile,
          city,
          state,
          loanType,
          followUpConsent,
          companyUrl,
          clientSubmissionKey: submissionKey(),
          utm: getAttributionPayload(),
          pageUrl: window.location.href,
          marketingConsent: hasMarketingConsent(),
          fbp: readCookie("_fbp"),
          fbc: readCookie("_fbc"),
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        fields?: FieldErrors | null;
        status?: "created" | "duplicate";
        reference?: string;
        eventId?: string | null;
        isTest?: boolean;
      } | null;
      if (!response.ok || !data?.status || !data.reference) {
        setErrors(data?.fields ?? {});
        setFormError(data?.error || "We could not save this enquiry. Please try again.");
        return;
      }
      if (data.status === "created") {
        emitLoanAssistanceBrowserLead({
          status: data.status,
          eventId: data.eventId ?? null,
          loanType,
        });
        rotateSubmissionKey();
      }
      setSuccess({ status: data.status, reference: data.reference, isTest: Boolean(data.isTest) });
    } catch {
      setFormError("We could not save this enquiry. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-[1.75rem] border border-line bg-white p-6 shadow-card sm:p-8" role="status" aria-live="polite">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-100 text-brand-700">
          <CheckCircle2 size={22} aria-hidden="true" />
        </span>
        <h2 className="font-display mt-5 text-2xl font-extrabold tracking-[-0.04em] text-navy-950">
          {success.status === "created" ? "Enquiry received" : "Enquiry already saved"}
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          {success.status === "created"
            ? "VP Loan Connect has saved this loan-assistance enquiry. A team member may contact you on the mobile number you entered to explain options and application preparation."
            : "An enquiry for this mobile number is already on file, so a second lead was not created."}
        </p>
        <p className="mt-4 text-sm font-bold text-navy-950">
          Reference <span className="font-mono">{success.reference}</span>
        </p>
        {success.isTest ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Test record. This is not a customer enquiry.</p>
        ) : null}
        <p className="mt-4 text-sm leading-7 text-slate-600">
          Keep this reference. Approval, interest rate and disbursement are decided only by a lender after its own checks. VP Loan Connect is not a lender.
        </p>
        <Link href="/privacy" className="mt-5 inline-flex text-sm font-bold text-brand-700 underline underline-offset-2">
          Read the Privacy Policy
        </Link>
      </div>
    );
  }

  return (
    <form id="enquiry" onSubmit={onSubmit} className="scroll-mt-28 rounded-[1.75rem] border border-line bg-white p-5 shadow-card sm:p-8" noValidate>
      <h2 className="font-display text-2xl font-extrabold tracking-[-0.04em] text-navy-950">Submit an enquiry</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Name, mobile, city, state and loan category. No Aadhaar, PAN, bank account or documents on this form.</p>
      <div className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label>
          Company website
          <input tabIndex={-1} autoComplete="off" value={companyUrl} onChange={(event) => setCompanyUrl(event.target.value)} />
        </label>
      </div>
      <div className="mt-6 grid gap-4">
        <Field label="Full name" required error={errors.fullName}>
          <Input name="fullName" autoComplete="name" value={fullName} aria-invalid={Boolean(errors.fullName)} onChange={(event) => setFullName(event.target.value)} />
        </Field>
        <Field label="Mobile number" required hint="10-digit Indian mobile. Used only to follow up on this enquiry." error={errors.mobile}>
          <Input name="mobile" inputMode="numeric" autoComplete="tel" value={mobile} aria-invalid={Boolean(errors.mobile)} onChange={(event) => setMobile(event.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City" required error={errors.city}>
            <Input name="city" autoComplete="address-level2" value={city} aria-invalid={Boolean(errors.city)} onChange={(event) => setCity(event.target.value)} />
          </Field>
          <Field label="State or union territory" required error={errors.state}>
            <Select name="state" value={state} aria-invalid={Boolean(errors.state)} onChange={(event) => setState(event.target.value)}>
              <option value="">Select</option>
              {INDIAN_STATES_AND_UTS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Loan category" required error={errors.loanType}>
          <Select name="loanType" value={loanType} aria-invalid={Boolean(errors.loanType)} onChange={(event) => setLoanType(event.target.value)}>
            <option value="">Select a category</option>
            {LOAN_ASSISTANCE_TYPES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </Select>
        </Field>
        <label className="flex items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-4 text-sm leading-6 text-navy-900">
          <input
            id={consentId}
            className="mt-1 h-4 w-4 accent-brand-600"
            type="checkbox"
            checked={followUpConsent}
            onChange={(event) => setFollowUpConsent(event.target.checked)}
          />
          <span>
            {ENQUIRY_FOLLOW_UP_CONSENT_TEXT}{" "}
            <Link href="/privacy" className="font-bold text-brand-700 underline underline-offset-2">Privacy Policy</Link>
          </span>
        </label>
        {errors.followUpConsent ? <p className="text-xs font-medium text-red-700" role="alert">{errors.followUpConsent}</p> : null}
      </div>
      {formError ? <p className="mt-4 text-sm font-medium text-red-700" role="alert">{formError}</p> : null}
      <Button type="submit" className="mt-6 w-full" size="lg" disabled={busy} aria-busy={busy}>
        {busy ? "Submitting enquiry…" : "Submit enquiry"}
      </Button>
      <p className="mt-3 text-center text-xs leading-5 text-slate-500">Submitting saves the enquiry. A button click alone is not counted as a lead.</p>
    </form>
  );
}
