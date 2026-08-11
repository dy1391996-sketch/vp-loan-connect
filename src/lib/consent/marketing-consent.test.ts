import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMarketingConsent } from "@/lib/consent/marketing-consent";

describe("marketing consent", () => {
  it("parses only granted/denied values", () => {
    assert.equal(parseMarketingConsent("granted"), "granted");
    assert.equal(parseMarketingConsent("denied"), "denied");
    assert.equal(parseMarketingConsent("yes"), null);
    assert.equal(parseMarketingConsent(""), null);
    assert.equal(parseMarketingConsent(undefined), null);
  });
});
