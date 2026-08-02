import { SignJWT, jwtVerify } from "jose";
import { getServerEnv } from "@/lib/env";

type TokenPurpose = "admin_session" | "lead_handoff" | "cron";

function secretFor(purpose: TokenPurpose) {
  const env = getServerEnv();
  return new TextEncoder().encode(purpose === "cron" ? env.CRON_SECRET : env.NEXTAUTH_SECRET);
}

export async function signAccessToken(
  purpose: TokenPurpose,
  subject: string,
  claims: Record<string, string | number | boolean> = {},
  expiresIn: string | number = "8h",
) {
  return new SignJWT({ purpose, ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretFor(purpose));
}

export async function verifyAccessToken(token: string, purpose: TokenPurpose) {
  const { payload } = await jwtVerify(token, secretFor(purpose), { algorithms: ["HS256"] });
  if (payload.purpose !== purpose || !payload.sub) throw new Error("INVALID_TOKEN_PURPOSE");
  return payload;
}
