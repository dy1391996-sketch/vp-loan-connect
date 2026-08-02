import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { createHash, randomBytes } from "node:crypto";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatInr(value: number | string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: Number(value) % 1 === 0 ? 0 : 2,
  }).format(Number(value));
}

export function normalizeIndianMobile(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  if (!/^[6-9]\d{9}$/.test(local)) throw new Error("Enter a valid 10-digit Indian mobile number.");
  return `+91${local}`;
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

export function generateReferralCode(seed?: string) {
  const suffix = sha256(seed ?? randomToken(8)).slice(0, 7).toUpperCase();
  return `VPLC${suffix}`;
}

export function safeJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item)));
}

export function redactMobile(mobile: string) {
  return mobile.replace(/(\+91)(\d{2})\d{4}(\d{4})/, "$1$2****$3");
}

export { maskPan } from "@/lib/domain/identity";

