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
  url.searchParams.set("mobile", normalizeIndianMobile(mobile));
  url.searchParams.set("authkey", env.OTP_API_KEY);
  url.searchParams.set("otp", code);

  if (!url.searchParams.get("template_id")) {
    throw new Error("MSG91 OTP template_id is missing from OTP_API_URL.");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
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
    throw new Error(data.message || "MSG91 rejected the OTP request.");
  }

  return {
    providerRef: data.request_id ?? data.requestId ?? `msg91-${Date.now()}`,
  };
}
