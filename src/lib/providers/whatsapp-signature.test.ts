import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { hasValidMetaSignature } from "@/app/api/webhooks/whatsapp/route";

test("Meta WhatsApp webhook signature requires a matching SHA-256 HMAC", () => {
  const raw = JSON.stringify({ entry: [] });
  const secret = "whatsapp-app-secret";
  const signature = createHmac("sha256", secret).update(raw).digest("hex");
  assert.equal(hasValidMetaSignature(raw, `sha256=${signature}`, secret), true);
  assert.equal(hasValidMetaSignature(`${raw}x`, `sha256=${signature}`, secret), false);
  assert.equal(hasValidMetaSignature(raw, "sha256=invalid", secret), false);
});
