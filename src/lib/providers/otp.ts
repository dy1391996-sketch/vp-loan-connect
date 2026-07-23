import { getServerEnv } from "@/lib/env";

export type OtpSendResult = { providerRef: string; developmentCode?: string };

export async function sendOtp(mobile: string, code: string): Promise<OtpSendResult> {
  const env = getServerEnv();
  if (env.OTP_PROVIDER === "mock") {
    if (env.NODE_ENV === "production") throw new Error("Mock OTP is disabled in production.");
    return { providerRef: `mock-${Date.now()}`, developmentCode: code };
  }
  if (!env.OTP_API_URL || !env.OTP_API_KEY) throw new Error("Custom OTP provider is not configured.");
  const response = await fetch(env.OTP_API_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.OTP_API_KEY}` },
    body: JSON.stringify({ mobile, code, purpose: "VP Loan Connect mobile verification" }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("OTP provider rejected the request.");
  const data = (await response.json()) as { id?: string };
  return { providerRef: data.id ?? `custom-${Date.now()}` };
}
