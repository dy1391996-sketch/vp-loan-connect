import { ageFromDob } from "@/lib/domain/cross-field-rules";
import { isIndividualPan, isValidPanFormat, normalizePan } from "@/lib/domain/identity";
import { isDisposableEmailDomain, isImpossibleMobile, looksLikeFakePersonName, looksLikeWeakAddress } from "@/lib/domain/risk-signals";
import {
  MAX_LOAN_AMOUNT,
  MIN_LOAN_AMOUNT,
  type QuickApplyFormState,
} from "@/lib/apply/quick-apply-state";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateQuickApplyStep(step: number, form: QuickApplyFormState): string {
  if (step === 1) {
    if (!Number.isFinite(form.loanAmount) || form.loanAmount < MIN_LOAN_AMOUNT) {
      return `Enter an amount of at least ₹${MIN_LOAN_AMOUNT.toLocaleString("en-IN")}.`;
    }
    if (form.loanAmount > MAX_LOAN_AMOUNT) {
      return `Maximum amount is ₹${MAX_LOAN_AMOUNT.toLocaleString("en-IN")}.`;
    }
    return "";
  }

  if (step === 2) {
    if (!form.loanPurpose.trim()) return "Select what you need the funds for.";
    return "";
  }

  if (step === 3) {
    if (looksLikeFakePersonName(form.fullName) || form.fullName.trim().length < 2) {
      return "Enter your full name as on PAN.";
    }
    if (!EMAIL_PATTERN.test(form.email.trim()) || isDisposableEmailDomain(form.email.trim())) {
      return "Enter a valid email address.";
    }
    const mobileDigits = form.mobile.replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(mobileDigits) || isImpossibleMobile(mobileDigits)) {
      return "Enter a valid 10-digit Indian mobile number.";
    }
    const age = ageFromDob(form.dateOfBirth);
    if (age === null) return "Enter a valid date of birth.";
    if (age < 21 || age > 60) return "Applicant age must be between 21 and 60 years.";
    if (!/^\d{6}$/.test(form.pinCode)) return "Enter a valid six-digit PIN code.";
    return "";
  }

  if (step === 4) {
    // OTP code length / MSG91 verify happen in the client verify handler.
    return "";
  }

  if (step === 5) {
    if (!form.employmentUi) return "Select your employment type.";
    const income = Number(form.monthlyIncome.replace(/\D/g, "") || "0");
    if (!Number.isFinite(income) || income < 5000) return "Enter your monthly net income.";
    if (form.employerOrBusinessName.trim().length < 2 || looksLikeFakePersonName(form.employerOrBusinessName)) {
      return "Enter employer or business name.";
    }
    const months = Number(form.durationMonths);
    if (!Number.isInteger(months) || months < 1 || months > 480) {
      return "Enter work experience or business vintage in months (1–480).";
    }
    if (form.employmentUi === "SALARIED") {
      if (!form.salaryCreditMode) return "Select how your salary is credited.";
      const day = Number(form.salaryDate);
      if (!Number.isInteger(day) || day < 1 || day > 31) return "Enter a valid salary date (1–31).";
    }
    return "";
  }

  if (step === 6) {
    if (form.existingEmi.trim() === "" || Number(form.existingEmi) < 0) {
      return "Enter your existing monthly EMI (use 0 if none).";
    }
    if (form.activeLoans.trim() === "" || Number(form.activeLoans) < 0) {
      return "Enter the number of active loans (use 0 if none).";
    }
    if (form.cardOutstanding.trim() === "" || Number(form.cardOutstanding) < 0) {
      return "Enter credit card outstanding (use 0 if none).";
    }
    if (form.currentOverdue === null) return "Tell us if any payment is overdue.";
    if (!form.creditRange) return "Select your self-reported CIBIL range.";
    return "";
  }

  if (step === 7) {
    const pan = normalizePan(form.panNumber);
    if (!isValidPanFormat(pan)) return "Enter a valid 10-character PAN (e.g. ABCDE1234F).";
    if (!isIndividualPan(pan)) return "Use an individual PAN (4th character must be P).";
    if (looksLikeWeakAddress(form.residentialAddress)) {
      return "Enter a complete current address (house/street/locality).";
    }
    if (form.city.trim().length < 2) return "Enter your city.";
    if (form.state.trim().length < 2) return "Enter your state.";
    const pin = form.addressPinCode || form.pinCode;
    if (!/^\d{6}$/.test(pin)) return "Enter a valid six-digit PIN code.";
    if (!form.residenceType) return "Select your residence type.";
    const years = Number(form.yearsAtAddress);
    if (!Number.isFinite(years) || years < 0 || years > 50) {
      return "Enter years at current address (0–50).";
    }
    return "";
  }

  if (step === 8) {
    if (!form.serviceConsent) {
      return "Please accept the mandatory consent to continue.";
    }
    return "";
  }

  return "";
}
