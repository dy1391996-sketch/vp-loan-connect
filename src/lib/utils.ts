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

export function generateBookingReference() {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = randomBytes(2).toString("hex").toUpperCase();
  return `VPN-${stamp}-${suffix}`;
}

export function safeJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item)));
}

export function redactMobile(mobile: string) {
  return mobile.replace(/(\+91)(\d{2})\d{4}(\d{4})/, "$1$2****$3");
}

export function redactPii(text: string) {
  return text
    .replace(/\+91[6-9]\d{9}/g, "[phone]")
    .replace(/\b[6-9]\d{9}\b/g, "[phone]")
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/gi, "[id]");
}

export function isWeekend(date: Date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}
