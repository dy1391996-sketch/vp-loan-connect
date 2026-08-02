import { errors as JoseErrors, jwtVerify, SignJWT } from "jose";
import { getServerEnv } from "@/lib/env";

type TokenPurpose = "otp_verified" | "mobile_otp_verified" | "result_access" | "report_access" | "lead_access" | "admin_session";

export type AccessTokenFailureReason =
  | "INVALID_TOKEN_PURPOSE"
  | "MISSING_SUBJECT"
  | "JWT_EXPIRED"
  | "JWT_INVALID"
  | "JWS_INVALID"
  | "JWS_SIGNATURE_VERIFICATION_FAILED"
  | "JWT_CLAIM_VALIDATION_FAILED"
  | "MALFORMED_TOKEN"
  | "TOKEN_VERIFICATION_FAILED";

/** Stable auth failure — never includes raw token material. */
export class AccessTokenError extends Error {
  readonly reason: AccessTokenFailureReason;

  constructor(reason: AccessTokenFailureReason) {
    super("TOKEN_VERIFICATION_FAILED");
    this.name = "AccessTokenError";
    this.reason = reason;
  }
}

export function isAccessTokenError(error: unknown): error is AccessTokenError {
  return error instanceof AccessTokenError;
}

export function classifyTokenVerificationError(error: unknown): AccessTokenFailureReason {
  if (error instanceof AccessTokenError) return error.reason;
  if (error instanceof Error && error.message === "INVALID_TOKEN_PURPOSE") return "INVALID_TOKEN_PURPOSE";
  if (error instanceof Error && error.message === "INVALID_TOKEN") return "TOKEN_VERIFICATION_FAILED";

  if (error instanceof JoseErrors.JWTExpired) return "JWT_EXPIRED";
  if (error instanceof JoseErrors.JWSSignatureVerificationFailed) return "JWS_SIGNATURE_VERIFICATION_FAILED";
  if (error instanceof JoseErrors.JWTClaimValidationFailed) return "JWT_CLAIM_VALIDATION_FAILED";
  if (error instanceof JoseErrors.JWTInvalid) return "JWT_INVALID";
  if (error instanceof JoseErrors.JWSInvalid) return "JWS_INVALID";
  if (error instanceof JoseErrors.JOSEError) {
    const code = String(error.code || error.name || "");
    if (/expir/i.test(code)) return "JWT_EXPIRED";
    if (/signature/i.test(code)) return "JWS_SIGNATURE_VERIFICATION_FAILED";
    if (/claim/i.test(code)) return "JWT_CLAIM_VALIDATION_FAILED";
    if (/invalid/i.test(code)) return "JWT_INVALID";
    return "TOKEN_VERIFICATION_FAILED";
  }

  if (error instanceof Error) {
    const text = `${error.name} ${error.message}`;
    if (/malformed|compact jws|invalid token/i.test(text)) return "MALFORMED_TOKEN";
  }

  return "TOKEN_VERIFICATION_FAILED";
}

function secret(purpose: TokenPurpose) {
  const env = getServerEnv();
  const value = purpose === "report_access" ? env.REPORT_SIGNING_SECRET : env.NEXTAUTH_SECRET;
  return new TextEncoder().encode(value);
}

export async function signAccessToken(purpose: TokenPurpose, subject: string, claims: Record<string, string>, expiresIn: string | number) {
  return new SignJWT({ purpose, ...claims }).setProtectedHeader({ alg: "HS256" }).setSubject(subject).setIssuedAt().setExpirationTime(expiresIn).sign(secret(purpose));
}

export async function verifyAccessToken(token: string, purpose: TokenPurpose) {
  if (typeof token !== "string" || token.trim().length < 20) {
    throw new AccessTokenError("MALFORMED_TOKEN");
  }

  try {
    const { payload } = await jwtVerify(token, secret(purpose), { algorithms: ["HS256"] });
    if (!payload.sub) throw new AccessTokenError("MISSING_SUBJECT");
    if (payload.purpose !== purpose) throw new AccessTokenError("INVALID_TOKEN_PURPOSE");
    return payload;
  } catch (error) {
    if (isAccessTokenError(error)) throw error;
    throw new AccessTokenError(classifyTokenVerificationError(error));
  }
}
