import { getServerEnv } from "@/lib/env";

export type OtpSendResult = { providerRef: string; developmentCode?: string };

type Msg91Response = {
  type?: string;
  message?: string;
  request_id?: string;
  requestId?: string;
};

function normalizeIndianMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  throw new Error("Mobile number must be a valid 10-digit Indian number.");
}

function getMsg91ErrorMessage(data: Msg91Response) {
  return typeof data.message === "string" && data.message.trim().length > 0 ? data.message : "MSG91 rejected the OTP request.";
}

export async function sendOtp(mobile: string, code: string): Promise<OtpSendResult> {
  const env = getServerEnv();

  if (env.OTP_PROVIDER === "mock") {
    if (env.NODE_ENV === "production") throw new Error("Mock OTP is disabled in production.");
    return { providerRef: `mock-${Date.now()}`, developmentCode: code };
  }

  if (!env.OTP_API_URL || !env.OTP_API_KEY) {
    throw new Error("Custom OTP provider is not configured.");
  }

  const url = new URL(env.OTP_API_URL);
  url.searchParams.delete("authkey");
  url.searchParams.set("mobile", normalizeIndianMobile(mobile));
  url.searchParams.set("otp", code);

  if (!url.searchParams.get("template_id")) {
    throw new Error("MSG91 OTP template_id is missing from OTP_API_URL.");
  }

  if (!url.searchParams.get("otp_length")) {
    url.searchParams.set("otp_length", "6");
  }

  if (!url.searchParams.get("otp_expiry")) {
    url.searchParams.set("otp_expiry", "10");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authkey: env.OTP_API_KEY },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });

  let data: Msg91Response = {};
  try {
    data = (await response.json()) as Msg91Response;
  } catch {
    // Keep a safe generic error below when MSG91 does not return JSON.
  }

  if (!response.ok || data.type === "error") {
    throw new Error(getMsg91ErrorMessage(data));
  }

  return {
    providerRef: data.request_id ?? data.requestId ?? `msg91-${Date.now()}`,
  };
}
