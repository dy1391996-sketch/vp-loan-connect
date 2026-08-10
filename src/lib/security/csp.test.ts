import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CONTENT_SECURITY_POLICY } from "@/lib/security/csp";

function directive(name: string): string {
  const found = CONTENT_SECURITY_POLICY.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `) || part === name);
  assert.ok(found, `CSP is missing the ${name} directive`);
  return found;
}

describe("Content-Security-Policy", () => {
  it("allows the Cashfree hosted checkout form submission (form-action)", () => {
    // The Cashfree v3 SDK opens hosted checkout by submitting a form to
    // api.cashfree.com — without this, checkout silently never opens.
    const formAction = directive("form-action");
    assert.match(formAction, /https:\/\/api\.cashfree\.com/);
    assert.match(formAction, /https:\/\/sandbox\.cashfree\.com/);
    assert.match(formAction, /https:\/\/\*\.cashfree\.com/);
  });

  it("keeps existing payment/OTP allowances intact", () => {
    const formAction = directive("form-action");
    assert.match(formAction, /'self'/);
    assert.match(formAction, /https:\/\/secure\.payu\.in/);
    assert.match(formAction, /https:\/\/\*\.phonepe\.com/);

    const scriptSrc = directive("script-src");
    assert.match(scriptSrc, /https:\/\/sdk\.cashfree\.com/);
    assert.match(scriptSrc, /https:\/\/checkout\.razorpay\.com/);
    assert.match(scriptSrc, /https:\/\/verify\.msg91\.com/);

    const connectSrc = directive("connect-src");
    assert.match(connectSrc, /https:\/\/api\.cashfree\.com/);
    assert.match(connectSrc, /https:\/\/\*\.cashfree\.com/);

    const frameSrc = directive("frame-src");
    assert.match(frameSrc, /https:\/\/\*\.cashfree\.com/);
  });

  it("keeps hardening directives", () => {
    assert.equal(directive("frame-ancestors"), "frame-ancestors 'none'");
    assert.equal(directive("object-src"), "object-src 'none'");
    assert.equal(directive("base-uri"), "base-uri 'self'");
    assert.equal(directive("default-src"), "default-src 'self'");
  });
});
