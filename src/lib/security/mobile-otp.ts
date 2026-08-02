import bcrypt from "bcryptjs";
import { isImpossibleMobile } from "@/lib/domain/risk-signals";
import { normalizeIndianMobile } from "@/lib/utils";

export const MOBILE_OTP_LENGTH = 6;
export const MOBILE_OTP_TTL_MS = 5 * 60 * 1000;
export const MOBILE_OTP_MAX_ATTEMPTS = 5;
export const MOBILE_OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const MOBILE_OTP_MAX_RESENDS = 3;
export const MOBILE_OTP_BCRYPT_ROUNDS = 10;
/** Consumed / invalidated hash placeholder — never a valid bcrypt of a user OTP. */
export const MOBILE_OTP_CONSUMED_HASH = "USED";

export type MobileOtpFailureCode =
  | "INVALID_MOBILE"
  | "OTP_NOT_FOUND"
  | "MOBILE_MISMATCH"
  | "OTP_ALREADY_USED"
  | "OTP_EXPIRED"
  | "TOO_MANY_ATTEMPTS"
  | "INVALID_OTP"
  | "RESEND_COOLDOWN"
  | "MAX_RESENDS"
  | "RATE_LIMITED";

export const MOBILE_OTP_MESSAGES: Record<MobileOtpFailureCode, string> = {
  INVALID_MOBILE: "Enter a valid Indian mobile number.",
  OTP_NOT_FOUND: "Complete mobile OTP verification again.",
  MOBILE_MISMATCH: "This OTP does not belong to that mobile number.",
  OTP_ALREADY_USED: "This OTP was already used. Request a new code.",
  OTP_EXPIRED: "This OTP has expired. Request a new code.",
  TOO_MANY_ATTEMPTS: "Too many incorrect attempts. Request a new OTP.",
  INVALID_OTP: "Incorrect OTP. Please try again.",
  RESEND_COOLDOWN: "Wait before requesting another OTP.",
  MAX_RESENDS: "Maximum OTP resends reached. Try again later.",
  RATE_LIMITED: "Too many OTP requests. Please try again later.",
};

/** Accept +91XXXXXXXXXX, 91XXXXXXXXXX, or 10-digit local; return E.164 +91… */
export function parseIndianMobileInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("INVALID_MOBILE");
  try {
    const normalized = normalizeIndianMobile(trimmed);
    if (isImpossibleMobile(normalized)) throw new Error("INVALID_MOBILE");
    return normalized;
  } catch {
    throw new Error("INVALID_MOBILE");
  }
}

export function generateMobileOtpCode(mockCode?: string): string {
  if (mockCode && /^\d{6}$/.test(mockCode)) return mockCode;
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function hashMobileOtp(code: string): Promise<string> {
  return bcrypt.hash(code, MOBILE_OTP_BCRYPT_ROUNDS);
}

export async function compareMobileOtp(code: string, otpHash: string): Promise<boolean> {
  if (!otpHash || otpHash === MOBILE_OTP_CONSUMED_HASH) return false;
  if (!/^\d{6}$/.test(code)) return false;
  return bcrypt.compare(code, otpHash);
}

export type MobileOtpRecordView = {
  mobile: string;
  otpHash: string;
  attemptCount: number;
  resendCount: number;
  expiresAt: Date;
  verifiedAt: Date | null;
  lastSentAt: Date;
};

export function evaluateMobileOtpVerify(
  record: MobileOtpRecordView,
  mobile: string,
  now = new Date(),
): { ok: true } | { ok: false; code: MobileOtpFailureCode } {
  if (record.mobile !== mobile) return { ok: false, code: "MOBILE_MISMATCH" };
  if (record.verifiedAt || record.otpHash === MOBILE_OTP_CONSUMED_HASH) return { ok: false, code: "OTP_ALREADY_USED" };
  if (record.expiresAt.getTime() <= now.getTime()) return { ok: false, code: "OTP_EXPIRED" };
  if (record.attemptCount >= MOBILE_OTP_MAX_ATTEMPTS) return { ok: false, code: "TOO_MANY_ATTEMPTS" };
  return { ok: true };
}

export function evaluateMobileOtpResend(
  record: MobileOtpRecordView,
  mobile: string,
  now = new Date(),
): { ok: true } | { ok: false; code: MobileOtpFailureCode; retryAfterSec?: number } {
  if (record.mobile !== mobile) return { ok: false, code: "MOBILE_MISMATCH" };
  if (record.verifiedAt) return { ok: false, code: "OTP_ALREADY_USED" };
  if (record.resendCount >= MOBILE_OTP_MAX_RESENDS) return { ok: false, code: "MAX_RESENDS" };
  const elapsed = now.getTime() - record.lastSentAt.getTime();
  if (elapsed < MOBILE_OTP_RESEND_COOLDOWN_MS) {
    return {
      ok: false,
      code: "RESEND_COOLDOWN",
      retryAfterSec: Math.ceil((MOBILE_OTP_RESEND_COOLDOWN_MS - elapsed) / 1000),
    };
  }
  return { ok: true };
}

export function mobileOtpExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + MOBILE_OTP_TTL_MS);
}

export function resendAvailableAt(lastSentAt: Date): Date {
  return new Date(lastSentAt.getTime() + MOBILE_OTP_RESEND_COOLDOWN_MS);
}
