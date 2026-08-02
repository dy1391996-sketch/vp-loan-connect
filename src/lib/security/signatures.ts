import { createHmac, timingSafeEqual } from "node:crypto";

export function safeEqualHex(a: string, b: string) {
  try {
    const first = Buffer.from(a, "hex");
    const second = Buffer.from(b, "hex");
    return first.length === second.length && timingSafeEqual(first, second);
  } catch {
    return false;
  }
}

export function verifyMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string) {
  if (!signatureHeader || !appSecret) return false;
  const provided = signatureHeader.startsWith("sha256=") ? signatureHeader.slice(7) : signatureHeader;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  return safeEqualHex(expected, provided);
}

export function verifyRazorpayWebhookSignature(rawBody: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}

export function verifyRazorpayPaymentSignature(orderId: string, paymentId: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}
