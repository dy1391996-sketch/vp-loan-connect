import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPublicInstagramUrl, isPublicTelHref, isPublicWhatsAppHref } from "@/lib/public-contact";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("public contact policy", () => {
  it("accepts only https Instagram / ig.me hosts", () => {
    assert.equal(getPublicInstagramUrl({ NEXT_PUBLIC_INSTAGRAM_URL: "https://www.instagram.com/vploanconnect/" }), "https://www.instagram.com/vploanconnect/");
    assert.equal(getPublicInstagramUrl({ NEXT_PUBLIC_INSTAGRAM_URL: "https://ig.me/m/vploanconnect" }), "https://ig.me/m/vploanconnect");
    assert.equal(getPublicInstagramUrl({ NEXT_PUBLIC_INSTAGRAM_URL: "https://evil.example/phish" }), "");
    assert.equal(getPublicInstagramUrl({ NEXT_PUBLIC_INSTAGRAM_URL: "http://www.instagram.com/x" }), "");
    assert.equal(getPublicInstagramUrl({}), "");
  });

  it("normalizes bare Instagram handles into https profile URLs", () => {
    assert.equal(getPublicInstagramUrl({ NEXT_PUBLIC_INSTAGRAM_URL: "@vploanconnect" }), "https://www.instagram.com/vploanconnect/");
    assert.equal(getPublicInstagramUrl({ NEXT_PUBLIC_INSTAGRAM_URL: "vploanconnect" }), "https://www.instagram.com/vploanconnect/");
  });

  it("detects WhatsApp and tel public CTA hrefs", () => {
    assert.equal(isPublicWhatsAppHref("https://wa.me/917827110079"), true);
    assert.equal(isPublicWhatsAppHref("https://api.whatsapp.com/send?phone=91"), true);
    assert.equal(isPublicWhatsAppHref("https://www.vploanconnect.in/apply/quick"), false);
    assert.equal(isPublicTelHref("tel:+911234567890"), true);
    assert.equal(isPublicTelHref("/contact"), false);
  });

  it("legacy script.js no longer embeds a WhatsApp business number CTA", () => {
    const script = readFileSync(path.join(process.cwd(), "script.js"), "utf8");
    assert.doesNotMatch(script, /wa\.me\//);
    assert.doesNotMatch(script, /917827110079/);
    assert.match(script, /\/apply\/quick/);
  });

  it("referral dashboard source no longer uses wa.me share CTAs", () => {
    const source = readFileSync(path.join(process.cwd(), "src/components/referral-dashboard-client.tsx"), "utf8");
    assert.doesNotMatch(source, /wa\.me/);
    assert.doesNotMatch(source, /whatsapp\.com/i);
  });

  it("public policy and product pages do not advertise WhatsApp, phones, or guaranteed approval", () => {
    const files = [
      "src/app/privacy/page.tsx",
      "src/app/consent-policy/page.tsx",
      "src/app/loan-readiness/page.tsx",
      "src/app/credit-health/page.tsx",
      "src/app/personal-loan/page.tsx",
      "src/app/page.tsx",
      "src/components/product/product-page.tsx",
      "src/components/connect-options-panel.tsx",
    ];
    for (const file of files) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      assert.doesNotMatch(source, /wa\.me/i, file);
      assert.doesNotMatch(source, /verified WhatsApp/i, file);
      assert.doesNotMatch(source, /official WhatsApp/i, file);
      assert.doesNotMatch(source, /Send WhatsApp/i, file);
      assert.doesNotMatch(source, /tel:\+?\d/, file);
      assert.doesNotMatch(source, /(?<!no )(?<!not )guaranteed approval/i, file);
      assert.doesNotMatch(source, /(?<!no )(?<!not )guaranteed rate/i, file);
      assert.doesNotMatch(source, /(?<!no )(?<!not )guaranteed disbursement/i, file);
    }
  });
});
