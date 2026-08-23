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
import { maskPan, normalizePan } from "@/lib/domain/identity";
import { normalizeEmailInput } from "@/lib/apply/quick-apply-validation";
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
  errors: Record<string, string>;
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

export function QuickApplyStepBody({ form, patch, step, errors, otp }: Props) {
  if (step === 1) {
    return (
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.045em] text-navy-950 sm:text-4xl">
          Start Your Credit Profile
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Enter a few details and verify your email. The ₹116.82 Credit Profile Booster comes next — the detailed profile questions come after verified payment.
        </p>
        <div className="mt-8 grid gap-4">
          <Field label="Full name as per PAN" required error={errors.fullName}>
            <Input
              value={form.fullName}
              aria-invalid={Boolean(errors.fullName)}
              onChange={(e) => patch({ fullName: e.target.value })}
              autoComplete="name"
            />
          </Field>
          <Field label="Email address" required error={errors.email}>
            <Input
              type="email"
              value={form.email}
              aria-invalid={Boolean(errors.email)}
              onChange={(e) => patch({ email: e.target.value })}
              onBlur={(e) => patch({ email: normalizeEmailInput(e.target.value) })}
              autoComplete="email"
              placeholder="you@email.com"
            />
          </Field>
          <Field label="Mobile number" hint="Needed for the secure payment record. We do not send SMS OTP." required error={errors.mobile}>
            <Input
              inputMode="numeric"
              maxLength={10}
              value={form.mobile}
              aria-invalid={Boolean(errors.mobile)}
              onChange={(e) => patch({ mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })}
              autoComplete="tel"
              placeholder="10-digit Indian mobile"
            />
          </Field>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.045em] text-navy-950">Verify your email</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">Enter the 6-digit code sent to your email. This confirms it’s you before we continue.</p>
        <div className="mt-6 rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-semibold text-navy-950">
          Code sent to <span className="font-extrabold">{otp.maskedEmail}</span>
          <button type="button" className="ml-3 font-bold text-brand-700 underline" onClick={otp.onChangeEmail}>
            Change email
          </button>
        </div>
        <Field label="6-digit verification code" required error={errors.otpCode}>
          <Input
            className="tracking-[0.35em]"
            inputMode="numeric"
            maxLength={6}
            value={otp.code}
            aria-invalid={Boolean(errors.otpCode)}
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

  if (step === 3) {
    return null;
  }

  if (step === 4) {
    return (
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.045em] text-navy-950">Let&apos;s understand your profile</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Payment is verified. These details estimate indicative affordability. This does not pull a bureau report or affect your CIBIL score.
        </p>
        <div className="mt-8 grid gap-4">
          <label className="block">
            <span className="text-sm font-bold text-navy-950">Loan amount</span>
            <div
              className={cn(
                "mt-2 flex min-h-[52px] items-center gap-2 rounded-2xl border bg-surface px-4",
                errors.loanAmount ? "border-red-400" : "border-line",
              )}
            >
              <span className="text-xl font-extrabold text-slate-400">₹</span>
              <input
                className="w-full bg-transparent py-3 text-2xl font-extrabold tracking-[-0.03em] text-navy-950 outline-none"
                inputMode="numeric"
                value={formatInrDigits(form.loanAmount)}
                aria-invalid={Boolean(errors.loanAmount)}
                aria-label="Loan amount"
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  patch({ loanAmount: digits ? Number(digits) : 0 });
                }}
              />
            </div>
            {errors.loanAmount ? (
              <span className="mt-2 block text-xs font-medium text-red-700" role="alert">
                {errors.loanAmount}
              </span>
            ) : null}
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {QUICK_AMOUNTS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => patch({ loanAmount: value })}
                className={cn(
                  "min-h-[48px] rounded-2xl border text-sm font-extrabold transition",
                  form.loanAmount === value ? "border-brand-600 bg-brand-100 text-brand-800" : "border-line bg-white text-navy-950 hover:border-brand-500",
                )}
              >
                {formatInr(value)}
              </button>
            ))}
          </div>
          <p className="text-sm font-bold text-navy-950">What do you need the funds for?</p>
          {errors.loanPurpose ? (
            <p className="text-xs font-medium text-red-700" role="alert">
              {errors.loanPurpose}
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          <Field label="Date of birth" required error={errors.dateOfBirth}>
            <Input type="date" value={form.dateOfBirth} aria-invalid={Boolean(errors.dateOfBirth)} onChange={(e) => patch({ dateOfBirth: e.target.value })} />
          </Field>
        </div>
        {errors.employmentUi ? (
          <p className="mt-4 text-xs font-medium text-red-700" role="alert">
            {errors.employmentUi}
          </p>
        ) : null}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {EMPLOYMENT_OPTIONS.map((item) => {
            const active = form.employmentUi === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => patch({ employmentUi: item.id })}
                className={cn(
                  "flex min-h-[52px] items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-extrabold transition",
                  active ? "border-brand-600 bg-brand-100 text-brand-800" : "border-line bg-white text-navy-950 hover:border-brand-500",
                )}
              >
                <Building2 size={18} />
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="mt-6 grid gap-4">
          <Field label="Monthly net income (₹)" required error={errors.monthlyIncome}>
            <Input
              inputMode="numeric"
              value={form.monthlyIncome}
              aria-invalid={Boolean(errors.monthlyIncome)}
              onChange={(e) => patch({ monthlyIncome: e.target.value.replace(/\D/g, "") })}
            />
          </Field>
          <Field label={form.employmentUi === "SALARIED" ? "Employer name" : "Business / practice name"} required error={errors.employerOrBusinessName}>
            <Input
              value={form.employerOrBusinessName}
              aria-invalid={Boolean(errors.employerOrBusinessName)}
              onChange={(e) => patch({ employerOrBusinessName: e.target.value })}
            />
          </Field>
          <Field label="Work experience / business vintage (months)" required error={errors.durationMonths}>
            <Input
              inputMode="numeric"
              value={form.durationMonths}
              aria-invalid={Boolean(errors.durationMonths)}
              onChange={(e) => patch({ durationMonths: e.target.value.replace(/\D/g, "").slice(0, 3) })}
            />
          </Field>
          {form.employmentUi === "SALARIED" ? (
            <>
              <Field label="Salary credit mode" required error={errors.salaryCreditMode}>
                <Select
                  value={form.salaryCreditMode}
                  aria-invalid={Boolean(errors.salaryCreditMode)}
                  onChange={(e) => patch({ salaryCreditMode: e.target.value as QuickApplyFormState["salaryCreditMode"] })}
                >
                  <option value="">Select</option>
                  <option value="bank">Bank credit</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                </Select>
              </Field>
              <Field label="Salary date (day of month)" required error={errors.salaryDate}>
                <Input
                  inputMode="numeric"
                  maxLength={2}
                  value={form.salaryDate}
                  aria-invalid={Boolean(errors.salaryDate)}
                  onChange={(e) => patch({ salaryDate: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                />
              </Field>
            </>
          ) : null}
          <Field label="Existing monthly EMI (₹)" required error={errors.existingEmi}>
            <Input
              inputMode="numeric"
              value={form.existingEmi}
              aria-invalid={Boolean(errors.existingEmi)}
              onChange={(e) => patch({ existingEmi: e.target.value.replace(/\D/g, "") })}
            />
          </Field>
          <Field label="Current active loans" required error={errors.activeLoans}>
            <Input
              inputMode="numeric"
              value={form.activeLoans}
              aria-invalid={Boolean(errors.activeLoans)}
              onChange={(e) => patch({ activeLoans: e.target.value.replace(/\D/g, "").slice(0, 2) })}
            />
          </Field>
          <Field label="Credit card outstanding (₹)" required error={errors.cardOutstanding}>
            <Input
              inputMode="numeric"
              value={form.cardOutstanding}
              aria-invalid={Boolean(errors.cardOutstanding)}
              onChange={(e) => patch({ cardOutstanding: e.target.value.replace(/\D/g, "") })}
            />
          </Field>
          <Field label="Any overdue payment?" required error={errors.currentOverdue}>
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
                    "min-h-[52px] rounded-2xl border text-sm font-extrabold transition",
                    form.currentOverdue === item.value ? "border-brand-600 bg-brand-100 text-brand-800" : "border-line bg-white hover:border-brand-500",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Self-reported CIBIL range" required error={errors.creditRange}>
            <div className="grid grid-cols-2 gap-2">
              {CREDIT_OPTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => patch({ creditRange: item.id })}
                  className={cn(
                    "min-h-[52px] rounded-2xl border text-sm font-extrabold transition",
                    form.creditRange === item.id ? "border-brand-600 bg-brand-100 text-brand-800" : "border-line bg-white hover:border-brand-500",
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

  if (step === 5) {
    const creditLabel = CREDIT_OPTIONS.find((item) => item.id === form.creditRange)?.label || "—";
    const employmentLabel = EMPLOYMENT_OPTIONS.find((item) => item.id === form.employmentUi)?.label || "—";
    return (
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.045em] text-navy-950">PAN, address and consent</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          PAN is format-checked only. It is not officially verified unless an authorised provider confirms it.
        </p>
        <div className="mt-8 grid gap-4">
          <Field label="PAN number" required error={errors.panNumber}>
            <Input
              className="uppercase"
              maxLength={10}
              value={form.panNumber}
              aria-invalid={Boolean(errors.panNumber)}
              onChange={(e) => patch({ panNumber: normalizePan(e.target.value) })}
              onBlur={(e) => patch({ panNumber: normalizePan(e.target.value) })}
              autoComplete="off"
            />
          </Field>
          <Field label="Current address" required error={errors.residentialAddress}>
            <Textarea
              value={form.residentialAddress}
              aria-invalid={Boolean(errors.residentialAddress)}
              onChange={(e) => patch({ residentialAddress: e.target.value })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="City" required error={errors.city}>
              <Input value={form.city} aria-invalid={Boolean(errors.city)} onChange={(e) => patch({ city: e.target.value })} />
            </Field>
            <Field label="State" required error={errors.state}>
              <Input value={form.state} aria-invalid={Boolean(errors.state)} onChange={(e) => patch({ state: e.target.value })} />
            </Field>
          </div>
          <Field label="PIN code" required error={errors.addressPinCode}>
            <Input
              inputMode="numeric"
              maxLength={6}
              value={form.addressPinCode || form.pinCode}
              aria-invalid={Boolean(errors.addressPinCode)}
              onChange={(e) => patch({ addressPinCode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
            />
          </Field>
          <Field label="Residence type" required error={errors.residenceType}>
            <Select
              value={form.residenceType}
              aria-invalid={Boolean(errors.residenceType)}
              onChange={(e) => patch({ residenceType: e.target.value as QuickApplyFormState["residenceType"] })}
            >
              <option value="">Select</option>
              <option value="OWNED">Owned</option>
              <option value="RENTED">Rented</option>
              <option value="PARENTAL">Parental</option>
              <option value="OTHER">Other</option>
            </Select>
          </Field>
          <Field label="Years at current address" required error={errors.yearsAtAddress}>
            <Input
              inputMode="numeric"
              value={form.yearsAtAddress}
              aria-invalid={Boolean(errors.yearsAtAddress)}
              onChange={(e) => patch({ yearsAtAddress: e.target.value.replace(/\D/g, "").slice(0, 2) })}
            />
          </Field>
        </div>

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

        <label className={cn("mt-6 flex items-start gap-3 rounded-2xl border bg-white p-4 text-sm leading-6 text-navy-950", errors.serviceConsent ? "border-red-400" : "border-line")}>
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
        {errors.serviceConsent ? (
          <p className="mt-2 text-xs font-medium text-red-700" role="alert">
            {errors.serviceConsent}
          </p>
        ) : null}
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

  return null;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="font-semibold text-slate-500">{label}</dt>
      <dd className="text-right font-extrabold text-navy-950">{value}</dd>
    </div>
  );
}
