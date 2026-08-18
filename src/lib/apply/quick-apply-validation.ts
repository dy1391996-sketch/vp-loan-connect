import { ageFromDob } from "@/lib/domain/cross-field-rules";
import { isIndividualPan, isValidPanFormat, normalizePan } from "@/lib/domain/identity";
import { isDisposableEmailDomain, isImpossibleMobile, looksLikeFakePersonName, looksLikeWeakAddress } from "@/lib/domain/risk-signals";
import {
  MAX_LOAN_AMOUNT,
  MIN_LOAN_AMOUNT,
  type QuickApplyFormState,
} from "@/lib/apply/quick-apply-state";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type QuickApplyFieldErrors = Record<string, string>;

function firstError(errors: QuickApplyFieldErrors): string {
  return Object.values(errors)[0] || "";
}

export function normalizeEmailInput(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeMobileInput(value: string): string {
  return value.replace(/\D/g, "").slice(-10);
}

export function validateQuickApplyStepFields(step: number, form: QuickApplyFormState): QuickApplyFieldErrors {
  const errors: QuickApplyFieldErrors = {};

  if (step === 1) {
    if (looksLikeFakePersonName(form.fullName) || form.fullName.trim().length < 2) {
      errors.fullName = "Enter your full name as on PAN.";
    }
    const email = normalizeEmailInput(form.email);
    if (!email) {
      errors.email = "Enter your email address.";
    } else if (!EMAIL_PATTERN.test(email) || isDisposableEmailDomain(email)) {
      errors.email = "Enter a valid email address.";
    }
    const mobileDigits = normalizeMobileInput(form.mobile);
    if (!/^[6-9]\d{9}$/.test(mobileDigits) || isImpossibleMobile(mobileDigits)) {
      errors.mobile = "Enter a valid 10-digit Indian mobile number.";
    }
    const age = ageFromDob(form.dateOfBirth);
    if (age === null) errors.dateOfBirth = "Enter a valid date of birth.";
    else if (age < 21 || age > 60) errors.dateOfBirth = "Applicant age must be between 21 and 60 years.";
    if (!/^\d{6}$/.test(form.pinCode)) errors.pinCode = "Enter a valid six-digit PIN code.";
    return errors;
  }

  if (step === 2) {
    return errors;
  }

  if (step === 3) {
    if (!Number.isFinite(form.loanAmount) || form.loanAmount <= 0) {
      errors.loanAmount = "Enter a valid loan amount.";
    } else if (form.loanAmount < MIN_LOAN_AMOUNT) {
      errors.loanAmount = `Enter an amount of at least ₹${MIN_LOAN_AMOUNT.toLocaleString("en-IN")}.`;
    } else if (form.loanAmount > MAX_LOAN_AMOUNT) {
      errors.loanAmount = `Maximum amount is ₹${MAX_LOAN_AMOUNT.toLocaleString("en-IN")}.`;
    }
    if (!form.loanPurpose.trim()) errors.loanPurpose = "Select what you need the funds for.";
    return errors;
  }

  if (step === 4) {
    if (!form.employmentUi) errors.employmentUi = "Select your employment type.";
    const income = Number(form.monthlyIncome.replace(/\D/g, "") || "0");
    if (!Number.isFinite(income) || income < 5000) {
      errors.monthlyIncome = "Enter your monthly net income.";
    }
    if (form.employerOrBusinessName.trim().length < 2 || looksLikeFakePersonName(form.employerOrBusinessName)) {
      errors.employerOrBusinessName = "Enter employer or business name.";
    }
    const months = Number(form.durationMonths);
    if (!Number.isInteger(months) || months < 1 || months > 480) {
      errors.durationMonths = "Enter work experience or business vintage in months (1–480).";
    }
    if (form.employmentUi === "SALARIED") {
      if (!form.salaryCreditMode) errors.salaryCreditMode = "Select how your salary is credited.";
      const day = Number(form.salaryDate);
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        errors.salaryDate = "Enter a valid salary date (1–31).";
      }
    }
    if (form.existingEmi.trim() === "" || Number(form.existingEmi) < 0 || !Number.isFinite(Number(form.existingEmi))) {
      errors.existingEmi = "Enter your existing monthly EMI (use 0 if none).";
    }
    if (form.activeLoans.trim() === "" || Number(form.activeLoans) < 0 || !Number.isFinite(Number(form.activeLoans))) {
      errors.activeLoans = "Enter the number of active loans (use 0 if none).";
    }
    if (form.cardOutstanding.trim() === "" || Number(form.cardOutstanding) < 0 || !Number.isFinite(Number(form.cardOutstanding))) {
      errors.cardOutstanding = "Enter credit card outstanding (use 0 if none).";
    }
    if (form.currentOverdue === null) errors.currentOverdue = "Tell us if any payment is overdue.";
    if (!form.creditRange) errors.creditRange = "Select your self-reported CIBIL range.";
    return errors;
  }

  if (step === 5) {
    const pan = normalizePan(form.panNumber);
    if (!pan) {
      errors.panNumber = "Enter your PAN number.";
    } else if (!isValidPanFormat(pan)) {
      errors.panNumber = "Enter a valid 10-character PAN (e.g. ABCDE1234F).";
    } else if (!isIndividualPan(pan)) {
      errors.panNumber = "Use an individual PAN (4th character must be P).";
    }
    if (looksLikeWeakAddress(form.residentialAddress)) {
      errors.residentialAddress = "Enter a complete current address (house/street/locality).";
    }
    if (form.city.trim().length < 2) errors.city = "Enter your city.";
    if (form.state.trim().length < 2) errors.state = "Enter your state.";
    const pin = form.addressPinCode || form.pinCode;
    if (!/^\d{6}$/.test(pin)) errors.addressPinCode = "Enter a valid six-digit PIN code.";
    if (!form.residenceType) errors.residenceType = "Select your residence type.";
    const years = Number(form.yearsAtAddress);
    if (!Number.isFinite(years) || years < 0 || years > 50) {
      errors.yearsAtAddress = "Enter years at current address (0–50).";
    }
    if (!form.serviceConsent) {
      errors.serviceConsent = "Please accept the mandatory consent to continue.";
    }
    return errors;
  }

  return errors;
}

export function validateQuickApplyStep(step: number, form: QuickApplyFormState): string {
  return firstError(validateQuickApplyStepFields(step, form));
}

export function isLoanNeedComplete(form: QuickApplyFormState): boolean {
  return validateQuickApplyStep(3, form) === "";
}

/** After email OTP, skip the loan-need screen when amount and purpose are already valid. */
export function getNextQuickApplyStep(step: number, form: QuickApplyFormState): number {
  if (step >= 6) return 6;
  if (step === 2 && isLoanNeedComplete(form)) return 4;
  return step + 1;
}

export function getPreviousQuickApplyStep(step: number, form: QuickApplyFormState): number {
  if (step <= 1) return 1;
  if (step === 4 && isLoanNeedComplete(form)) return 2;
  return step - 1;
}
