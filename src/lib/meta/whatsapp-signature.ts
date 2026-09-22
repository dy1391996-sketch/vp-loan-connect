import { createHmac, timingSafeEqual } from "node:crypto";

export function hasValidMetaSignature(raw: string, header: string | null, secret: string) {
  if (!secret || !header?.startsWith("sha256=")) return false;
  const supplied = header.slice(7);
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const suppliedBuffer = Buffer.from(supplied, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}
