/**
 * MSG91 OTP widget helpers for custom (non-popup) email verification UI.
 * Uses exposeMethods so send/retry/verify run against our own inputs.
 */

const SCRIPT_URLS = ["https://verify.msg91.com/otp-provider.js", "https://verify.phone91.com/otp-provider.js"];

type Msg91Window = Window & {
  initSendOTP?: (config: Record<string, unknown>) => void;
  sendOtp?: (identifier: string, success?: (data: unknown) => void, failure?: (err: unknown) => void) => void;
  retryOtp?: (channel: string | null, success?: (data: unknown) => void, failure?: (err: unknown) => void) => void;
  verifyOtp?: (otp: string, success?: (data: unknown) => void, failure?: (err: unknown) => void) => void;
};

function getWin(): Msg91Window {
  return window as Msg91Window;
}

export function getMsg91AccessToken(payload: unknown): string | null {
  if (typeof payload === "string" && payload.length > 10) return payload;
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  for (const key of ["accessToken", "access-token", "token", "message"]) {
    const value = record[key];
    if (typeof value === "string" && value.length > 10) return value;
  }
  if (record.data && typeof record.data === "object") {
    return getMsg91AccessToken(record.data);
  }
  return null;
}

export function extractReqId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.reqId === "string") return record.reqId;
  if (typeof record.request_id === "string") return record.request_id;
  if (record.data) return extractReqId(record.data);
  if (typeof record.message === "string" && record.message.length > 8 && !record.message.includes(" ")) {
    return record.message;
  }
  return null;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Email OTP service unavailable."));
    document.head.appendChild(script);
  });
}

async function ensureWidgetScript(): Promise<void> {
  if (typeof getWin().initSendOTP === "function") return;
  let lastError: Error | null = null;
  for (const url of SCRIPT_URLS) {
    try {
      await loadScript(url);
      if (typeof getWin().initSendOTP === "function") return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Email OTP service unavailable.");
    }
  }
  throw lastError || new Error("Email OTP service unavailable.");
}

let methodsReady: Promise<void> | null = null;

export async function prepareMsg91EmailOtp(widgetId: string, tokenAuth: string): Promise<void> {
  if (!widgetId || !tokenAuth) throw new Error("Email OTP is not configured.");
  await ensureWidgetScript();
  if (typeof getWin().sendOtp === "function" && typeof getWin().verifyOtp === "function") {
    return;
  }
  if (!methodsReady) {
    methodsReady = new Promise((resolve, reject) => {
      try {
        getWin().initSendOTP?.({
          widgetId,
          tokenAuth,
          exposeMethods: true,
          success: () => undefined,
          failure: () => undefined,
        });
        // Methods are attached synchronously after init with exposeMethods.
        window.setTimeout(() => {
          if (typeof getWin().sendOtp === "function") resolve();
          else reject(new Error("Email OTP methods are unavailable."));
        }, 50);
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Email OTP could not start."));
      }
    });
  }
  await methodsReady;
}

export async function sendMsg91EmailOtp(email: string): Promise<{ reqId: string | null }> {
  const win = getWin();
  if (typeof win.sendOtp !== "function") throw new Error("Email OTP is not ready. Please try again.");
  return new Promise((resolve, reject) => {
    win.sendOtp?.(
      email,
      (data) => resolve({ reqId: extractReqId(data) }),
      (err) => reject(new Error(typeof err === "string" ? err : "Could not send verification code.")),
    );
  });
}

export async function retryMsg91EmailOtp(): Promise<void> {
  const win = getWin();
  if (typeof win.retryOtp !== "function") throw new Error("Resend is not available yet.");
  return new Promise((resolve, reject) => {
    win.retryOtp?.(
      null,
      () => resolve(),
      (err) => reject(new Error(typeof err === "string" ? err : "Could not resend code.")),
    );
  });
}

export async function verifyMsg91EmailOtp(otp: string): Promise<string> {
  const win = getWin();
  if (typeof win.verifyOtp !== "function") throw new Error("Email OTP is not ready.");
  return new Promise((resolve, reject) => {
    win.verifyOtp?.(
      otp,
      (data) => {
        const token = getMsg91AccessToken(data);
        if (!token) reject(new Error("Verification token missing. Please try again."));
        else resolve(token);
      },
      (err) => {
        const message = typeof err === "string" ? err : "Invalid or expired code. Please try again.";
        reject(new Error(message));
      },
    );
  });
}
