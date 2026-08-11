import {
  Banknote,
  BriefcaseBusiness,
  Building2,
  GraduationCap,
  HeartPulse,
  Home,
  Plane,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import {
  CREDIT_OPTIONS,
  EMPLOYMENT_OPTIONS,
  LOAN_PURPOSES,
  QUICK_AMOUNTS,
  formatInrDigits,
  type QuickApplyFormState,
} from "@/lib/apply/quick-apply-state";
import { maskPan } from "@/lib/domain/identity";
import { cn, formatInr } from "@/lib/utils";

const PURPOSE_ICONS: Record<string, typeof HeartPulse> = {
  medical: HeartPulse,
  personal: WalletCards,
  debt: Banknote,
  education: GraduationCap,
  wedding: Sparkles,
  travel: Plane,
  home: Home,
  business: BriefcaseBusiness,
  other: Sparkles,
};

type Props = {
  form: QuickApplyFormState;
  patch: (partial: Partial<QuickApplyFormState>) => void;
  step: number;
  otp: {
    code: string;
    setCode: (value: string) => void;
    maskedEmail: string;
    resendIn: number;
    onResend: () => void;
    onChangeEmail: () => void;
    sending: boolean;
  };
};

export function QuickApplyStepBody({ form, patch, step, otp }: Props) {
  if (step === 1) {
    return (
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.045em] text-navy-950 sm:text-4xl">
          How much funding are you looking for?
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">Choose an amount to begin your profile check.</p>
        <label className="mt-8 block">
          <span className="text-sm font-bold text-navy-950">Loan amount</span>
          <div className="mt-2 flex min-h-[52px] items-center gap-2 rounded-2xl border border-line bg-surface px-4">
            <span className="text-xl font-extrabold text-slate-400">₹</span>
            <input
              className="w-full bg-transparent py-3 text-2xl font-extrabold tracking-[-0.03em] text-navy-950 outline-none"
              inputMode="numeric"
              value={formatInrDigits(form.loanAmount)}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "");
                patch({ loanAmount: digits ? Number(digits) : 0 });
              }}
              aria-label="Loan amount"
            />
          </div>
        </label>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {QUICK_AMOUNTS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => patch({ loanAmount: value })}
              className={cn(
                "min-h-[52px] rounded-xl border px-3 text-sm font-extrabold transition",
                form.loanAmount === value ? "border-brand-600 bg-brand-100 text-brand-800" : "border-line bg-white text-navy-950 hover:border-brand-500",
              )}
            >
              {formatInr(value)}
            </button>
          ))}
        </div>
        <p className="mt-6 text-xs leading-6 text-slate-500">Final eligibility and amount are decided only by the relevant lender.</p>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.045em] text-navy-950">What do you need the funds for?</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">Select one purpose that best matches your need.</p>
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {LOAN_PURPOSES.map((item) => {
            const Icon = PURPOSE_ICONS[item.id] || Sparkles;
            const active = form.loanPurpose === item.value;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => patch({ loanPurpose: item.value })}
                className={cn(
                  "flex min-h-[52px] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
                  active ? "border-brand-600 bg-brand-100 text-brand-800" : "border-line bg-white text-navy-950 hover:border-brand-500",
                )}
              >
                <span className={cn("grid h-10 w-10 place-items-center rounded-xl", active ? "bg-white text-brand-700" : "bg-surface text-slate-600")}>
                  <Icon size={18} />
                </span>
                <span className="text-sm font-extrabold">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.045em] text-navy-950">Tell us about yourself</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">We use this to build your preliminary profile. Mobile is for contact only — no SMS OTP.</p>
        <div className="mt-8 grid gap-4">
          <Field label="Full name as per PAN" required>
            <Input value={form.fullName} onChange={(e) => patch({ fullName: e.target.value })} autoComplete="name" />
          </Field>
          <Field label="Email address" required>
            <Input type="email" value={form.email} onChange={(e) => patch({ email: e.target.value })} autoComplete="email" />
          </Field>
          <Field label="Mobile number" hint="Collected as profile information only. We do not send SMS OTP." required>
            <Input
              inputMode="numeric"
              maxLength={10}
              value={form.mobile}
              onChange={(e) => patch({ mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })}
              autoComplete="tel"
              placeholder="10-digit Indian mobile"
            />
          </Field>
          <Field label="Date of birth" required>
            <Input type="date" value={form.dateOfBirth} onChange={(e) => patch({ dateOfBirth: e.target.value })} />
          </Field>
          <Field label="PIN code" required>
            <Input
              inputMode="numeric"
              maxLength={6}
              value={form.pinCode}
              onChange={(e) => patch({ pinCode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
            />
          </Field>
        </div>
      </div>
    );
  }

  if (step === 4) {
    return (
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.045em] text-navy-950">Verify your email</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">We’ll send a secure verification code to your email address.</p>
        <div className="mt-6 rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-semibold text-navy-950">
          Code sent to <span className="font-extrabold">{otp.maskedEmail}</span>
          <button type="button" className="ml-3 font-bold text-brand-700 underline" onClick={otp.onChangeEmail}>
            Change email
          </button>
        </div>
        <Field label="6-digit verification code" required>
          <Input
            className="tracking-[0.35em]"
            inputMode="numeric"
            maxLength={6}
            value={otp.code}
            onChange={(e) => otp.setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            autoComplete="one-time-code"
            aria-label="Email verification code"
          />
        </Field>
        <p className="mt-4 text-sm text-slate-600" aria-live="polite">
          {otp.resendIn > 0 ? (
            <>Resend available in {otp.resendIn}s</>
          ) : (
            <button type="button" className="font-bold text-brand-700 underline disabled:opacity-50" disabled={otp.sending} onClick={otp.onResend}>
              Resend code
            </button>
          )}
        </p>
      </div>
    );
  }

  if (step === 5) {
    return (
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.045em] text-navy-950">Your work and income</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">Tell us how you earn so we can estimate indicative affordability.</p>
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {EMPLOYMENT_OPTIONS.map((item) => {
            const active = form.employmentUi === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => patch({ employmentUi: item.id })}
                className={cn(
                  "flex min-h-[52px] items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-extrabold",
                  active ? "border-brand-600 bg-brand-100 text-brand-800" : "border-line bg-white text-navy-950",
                )}
              >
                <Building2 size={18} />
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="mt-6 grid gap-4">
          <Field label="Monthly net income (₹)" required>
            <Input
              inputMode="numeric"
              value={form.monthlyIncome}
              onChange={(e) => patch({ monthlyIncome: e.target.value.replace(/\D/g, "") })}
            />
          </Field>
          <Field label={form.employmentUi === "SALARIED" ? "Employer name" : "Business / practice name"} required>
            <Input value={form.employerOrBusinessName} onChange={(e) => patch({ employerOrBusinessName: e.target.value })} />
          </Field>
          <Field label="Work experience / business vintage (months)" required>
            <Input
              inputMode="numeric"
              value={form.durationMonths}
              onChange={(e) => patch({ durationMonths: e.target.value.replace(/\D/g, "").slice(0, 3) })}
            />
          </Field>
          {form.employmentUi === "SALARIED" ? (
            <>
              <Field label="Salary credit mode" required>
                <Select value={form.salaryCreditMode} onChange={(e) => patch({ salaryCreditMode: e.target.value as QuickApplyFormState["salaryCreditMode"] })}>
                  <option value="">Select</option>
                  <option value="bank">Bank credit</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                </Select>
              </Field>
              <Field label="Salary date (day of month)" required>
                <Input
                  inputMode="numeric"
                  maxLength={2}
                  value={form.salaryDate}
                  onChange={(e) => patch({ salaryDate: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                />
              </Field>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  if (step === 6) {
    return (
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.045em] text-navy-950">Help us understand your current commitments</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">This does not pull your bureau report and does not affect your CIBIL score.</p>
        <div className="mt-8 grid gap-4">
          <Field label="Existing monthly EMI (₹)" required>
            <Input inputMode="numeric" value={form.existingEmi} onChange={(e) => patch({ existingEmi: e.target.value.replace(/\D/g, "") })} />
          </Field>
          <Field label="Current active loans" required>
            <Input inputMode="numeric" value={form.activeLoans} onChange={(e) => patch({ activeLoans: e.target.value.replace(/\D/g, "").slice(0, 2) })} />
          </Field>
          <Field label="Credit card outstanding (₹)" required>
            <Input inputMode="numeric" value={form.cardOutstanding} onChange={(e) => patch({ cardOutstanding: e.target.value.replace(/\D/g, "") })} />
          </Field>
          <Field label="Any overdue payment?" required>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "No", value: false },
                { label: "Yes", value: true },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => patch({ currentOverdue: item.value })}
                  className={cn(
                    "min-h-[52px] rounded-2xl border text-sm font-extrabold",
                    form.currentOverdue === item.value ? "border-brand-600 bg-brand-100 text-brand-800" : "border-line bg-white",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Self-reported CIBIL range" required>
            <div className="grid grid-cols-2 gap-2">
              {CREDIT_OPTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => patch({ creditRange: item.id })}
                  className={cn(
                    "min-h-[52px] rounded-2xl border text-sm font-extrabold",
                    form.creditRange === item.id ? "border-brand-600 bg-brand-100 text-brand-800" : "border-line bg-white",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </div>
    );
  }

  if (step === 7) {
    return (
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.045em] text-navy-950">Identity and address</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">PAN is format-checked only. It is not officially verified unless an authorised provider confirms it.</p>
        <div className="mt-8 grid gap-4">
          <Field label="PAN number" required>
            <Input
              className="uppercase"
              maxLength={10}
              value={form.panNumber}
              onChange={(e) => patch({ panNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) })}
            />
          </Field>
          <Field label="Current address" required>
            <Textarea value={form.residentialAddress} onChange={(e) => patch({ residentialAddress: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="City" required>
              <Input value={form.city} onChange={(e) => patch({ city: e.target.value })} />
            </Field>
            <Field label="State" required>
              <Input value={form.state} onChange={(e) => patch({ state: e.target.value })} />
            </Field>
          </div>
          <Field label="PIN code" required>
            <Input
              inputMode="numeric"
              maxLength={6}
              value={form.addressPinCode || form.pinCode}
              onChange={(e) => patch({ addressPinCode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
            />
          </Field>
          <Field label="Residence type" required>
            <Select value={form.residenceType} onChange={(e) => patch({ residenceType: e.target.value as QuickApplyFormState["residenceType"] })}>
              <option value="">Select</option>
              <option value="OWNED">Owned</option>
              <option value="RENTED">Rented</option>
              <option value="PARENTAL">Parental</option>
              <option value="OTHER">Other</option>
            </Select>
          </Field>
          <Field label="Years at current address" required>
            <Input
              inputMode="numeric"
              value={form.yearsAtAddress}
              onChange={(e) => patch({ yearsAtAddress: e.target.value.replace(/\D/g, "").slice(0, 2) })}
            />
          </Field>
        </div>
      </div>
    );
  }

  // Step 8 consent
  const creditLabel = CREDIT_OPTIONS.find((item) => item.id === form.creditRange)?.label || "—";
  const employmentLabel = EMPLOYMENT_OPTIONS.find((item) => item.id === form.employmentUi)?.label || "—";
  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold tracking-[-0.045em] text-navy-950">Review and consent</h1>
      <p className="mt-3 text-sm leading-7 text-slate-600">Confirm your details before we generate a preliminary profile assessment.</p>
      <dl className="mt-8 grid gap-3 rounded-2xl border border-line bg-surface p-5 text-sm">
        <SummaryRow label="Requested amount" value={formatInr(form.loanAmount)} />
        <SummaryRow label="Loan purpose" value={form.loanPurpose || "—"} />
        <SummaryRow label="Employment" value={employmentLabel} />
        <SummaryRow label="Monthly income" value={form.monthlyIncome ? formatInr(Number(form.monthlyIncome)) : "—"} />
        <SummaryRow label="Existing EMI" value={form.existingEmi ? formatInr(Number(form.existingEmi)) : "—"} />
        <SummaryRow label="Credit range" value={creditLabel} />
        <SummaryRow label="Email" value={form.email} />
        <SummaryRow label="PAN" value={form.panNumber ? maskPan(form.panNumber) : "—"} />
      </dl>

      <label className="mt-6 flex items-start gap-3 rounded-2xl border border-line bg-white p-4 text-sm leading-6 text-navy-950">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 accent-brand-600"
          checked={form.serviceConsent}
          onChange={(e) => patch({ serviceConsent: e.target.checked })}
        />
        <span>
          I consent to VP Loan Connect using my information to generate a preliminary profile assessment and display relevant loan options.
        </span>
      </label>
      <label className="mt-3 flex items-start gap-3 rounded-2xl border border-line bg-white p-4 text-sm leading-6 text-navy-950">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 accent-brand-600"
          checked={form.marketingConsent}
          onChange={(e) => patch({ marketingConsent: e.target.checked })}
        />
        <span>I agree to receive promotional communication by email or other consented channels.</span>
      </label>
      <p className="mt-4 text-xs leading-6 text-slate-500">
        Read our{" "}
        <a className="font-bold text-brand-700 underline" href="/privacy" target="_blank" rel="noreferrer">
          Privacy Policy
        </a>
        ,{" "}
        <a className="font-bold text-brand-700 underline" href="/terms" target="_blank" rel="noreferrer">
          Terms
        </a>
        ,{" "}
        <a className="font-bold text-brand-700 underline" href="/consent-policy" target="_blank" rel="noreferrer">
          Consent Policy
        </a>{" "}
        and{" "}
        <a className="font-bold text-brand-700 underline" href="/disclaimer" target="_blank" rel="noreferrer">
          Disclaimer
        </a>
        .
      </p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="font-semibold text-slate-500">{label}</dt>
      <dd className="text-right font-extrabold text-navy-950">{value}</dd>
    </div>
  );
}
