import assert from "node:assert/strict";
import test from "node:test";
import nextConfig from "../../../next.config";
import { CASHFREE_HOSTED_CHECKOUT_URL } from "@/lib/payments/cashfree-checkout";

/**
 * Regression guard for the production outage where "Preparing secure payment…" span forever:
 * CSP `form-action` omitted Cashfree, so the browser silently blocked the top-level form POST
 * that opens the hosted checkout page ("Sending form data to … violates … form-action").
 */
async function contentSecurityPolicy(): Promise<string> {
  const headerRules = await nextConfig.headers!();
  const globalRule = headerRules.find((rule) => rule.source === "/:path*");
  assert.ok(globalRule, "a site-wide header rule must exist");
  const csp = globalRule.headers.find((header) => header.key === "Content-Security-Policy");
  assert.ok(csp, "Content-Security-Policy must be set");
  return csp.value;
}

function directive(csp: string, name: string): string[] {
  const found = csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `));
  assert.ok(found, `CSP must declare ${name}`);
  return found.split(/\s+/).slice(1);
}

test("form-action allows every Cashfree hosted checkout host the app can redirect to", async () => {
  const formAction = directive(await contentSecurityPolicy(), "form-action");
  for (const url of Object.values(CASHFREE_HOSTED_CHECKOUT_URL)) {
    const origin = new URL(url).origin;
    assert.ok(
      formAction.includes(origin),
      `form-action must include ${origin}; otherwise the browser blocks the hosted checkout redirect`,
    );
  }
});

test("form-action still allows the other supported hosted gateways", async () => {
  const formAction = directive(await contentSecurityPolicy(), "form-action");
  for (const origin of ["'self'", "https://secure.payu.in", "https://test.payu.in", "https://api.phonepe.com"]) {
    assert.ok(formAction.includes(origin), `form-action must include ${origin}`);
  }
});

test("form-action is not opened up to every origin", async () => {
  const formAction = directive(await contentSecurityPolicy(), "form-action");
  assert.ok(!formAction.includes("*"), "form-action must never be a wildcard");
  assert.ok(!formAction.includes("https:"), "form-action must never allow all https origins");
});

test("core protections stay locked down", async () => {
  const csp = await contentSecurityPolicy();
  assert.deepEqual(directive(csp, "default-src"), ["'self'"]);
  assert.deepEqual(directive(csp, "frame-ancestors"), ["'none'"]);
  assert.deepEqual(directive(csp, "object-src"), ["'none'"]);
  assert.deepEqual(directive(csp, "base-uri"), ["'self'"]);
});

test("connect-src still allows Cashfree so status reconciliation keeps working", async () => {
  const connect = directive(await contentSecurityPolicy(), "connect-src");
  assert.ok(connect.includes("https://api.cashfree.com"));
});
