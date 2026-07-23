import { jwtVerify, SignJWT } from "jose";
import { getServerEnv } from "@/lib/env";

type TokenPurpose = "otp_verified" | "result_access" | "report_access" | "lead_access" | "admin_session";

function secret(purpose: TokenPurpose) {
  const env = getServerEnv();
  const value = purpose === "report_access" ? env.REPORT_SIGNING_SECRET : env.NEXTAUTH_SECRET;
  return new TextEncoder().encode(value);
}

export async function signAccessToken(purpose: TokenPurpose, subject: string, claims: Record<string, string>, expiresIn: string | number) {
  return new SignJWT({ purpose, ...claims }).setProtectedHeader({ alg: "HS256" }).setSubject(subject).setIssuedAt().setExpirationTime(expiresIn).sign(secret(purpose));
}

export async function verifyAccessToken(token: string, purpose: TokenPurpose) {
  const { payload } = await jwtVerify(token, secret(purpose), { algorithms: ["HS256"] });
  if (payload.purpose !== purpose || !payload.sub) throw new Error("INVALID_TOKEN_PURPOSE");
  return payload;
}
