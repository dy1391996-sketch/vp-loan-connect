import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { loanAssistanceDestination } from "@/lib/loan-assistance/campaign";
import {
  ENQUIRY_FOLLOW_UP_CONSENT_TEXT,
  LOAN_ASSISTANCE_INTRO,
  LOAN_ASSISTANCE_SERVICE_SUMMARY,
  VPLC_TEST_NAME_PREFIX,
} from "@/lib/loan-assistance/constants";
import { createMemoryEnquiryStore } from "@/lib/loan-assistance/memory-store";
import { createLoanAssistanceEnquiry, shouldEmitLoanAssistanceLead } from "@/lib/loan-assistance/service";
import { sanitizeLoanAssistancePageUrl, validateLoanAssistanceInput } from "@/lib/loan-assistance/validation";
import { isConsentPageViewPath } from "@/lib/meta/pageview-paths";

const KEY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const KEY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    fullName: `${VPLC_TEST_NAME_PREFIX}Rahul Sharma`,
    mobile: "9812345670",
    city: "Pune",
    state: "Maharashtra",
    loanType: "Personal loan",
    followUpConsent: true,
    clientSubmissionKey: KEY_A,
    utm: { utm_source: "instagram", utm_campaign: "ig_loan_assistance_5d", utm_content: "assist_a" },
    pageUrl: "https://www.vploanconnect.in/loan-assistance?utm_source=instagram&mobile=9812345670",
    marketingConsent: true,
    ...overrides,
  };
}

describe("loan assistance validation", () => {
  it("accepts the minimal enquiry and strips contact details from attribution", () => {
    const parsed = validateLoanAssistanceInput(validBody());
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.data.isTest, true);
    assert.equal(parsed.data.mobile, "+919812345670");
    assert.equal(parsed.data.utm?.utm_source, "instagram");
    assert.equal(parsed.data.pageUrl.includes("9812345670"), false);
    assert.equal(parsed.data.pageUrl.includes("utm_source=instagram"), true);
  });

  it("rejects missing consent, bad mobile, and honeypot fills", () => {
    const missingConsent = validateLoanAssistanceInput(validBody({ followUpConsent: false }));
    assert.equal(missingConsent.ok, false);
    if (!missingConsent.ok) assert.equal(Boolean(missingConsent.fields?.followUpConsent), true);

    const badMobile = validateLoanAssistanceInput(validBody({ mobile: "12345" }));
    assert.equal(badMobile.ok, false);

    const honeypot = validateLoanAssistanceInput(validBody({ companyUrl: "https://spam.example" }));
    assert.equal(honeypot.ok, false);
    if (!honeypot.ok) assert.equal(honeypot.fields, undefined);
  });

  it("does not keep a phone number or unrelated path in the event URL", () => {
    assert.equal(
      sanitizeLoanAssistancePageUrl("https://www.vploanconnect.in/apply/quick?utm_source=instagram"),
      "https://www.vploanconnect.in/loan-assistance",
    );
    assert.equal(sanitizeLoanAssistancePageUrl("https://evil.example/loan-assistance"), "https://www.vploanconnect.in/loan-assistance");
  });
});

describe("loan assistance persistence and lead events", () => {
  it("stores one test enquiry and does not emit a second lead for a duplicate", async () => {
    const store = createMemoryEnquiryStore();
    const now = new Date("2026-09-26T08:00:00.000Z");
    const firstParsed = validateLoanAssistanceInput(validBody());
    assert.equal(firstParsed.ok, true);
    if (!firstParsed.ok) return;
    const first = await createLoanAssistanceEnquiry({
      draft: firstParsed.data,
      store,
      now,
      marketingConsentGranted: true,
    });
    assert.equal(first.status, "created");
    assert.equal(first.isTest, true);
    assert.equal(shouldEmitLoanAssistanceLead(first, true), true);
    assert.equal(store.rows.length, 1);
    assert.equal(store.rows[0]?.metaEventId, first.eventId);

    const secondParsed = validateLoanAssistanceInput(validBody({ clientSubmissionKey: KEY_B, city: "Nashik" }));
    assert.equal(secondParsed.ok, true);
    if (!secondParsed.ok) return;
    const second = await createLoanAssistanceEnquiry({
      draft: secondParsed.data,
      store,
      now: new Date(now.getTime() + 60_000),
      marketingConsentGranted: true,
    });
    assert.equal(second.status, "duplicate");
    assert.equal(second.reference, first.reference);
    assert.equal(second.eventId, null);
    assert.equal(shouldEmitLoanAssistanceLead(second, true), false);
    assert.equal(store.rows.length, 1);
    assert.equal(store.rows[0]?.city, "Pune");
  });

  it("does not create a lead event id when marketing consent is absent", async () => {
    const store = createMemoryEnquiryStore();
    const parsed = validateLoanAssistanceInput(validBody({ marketingConsent: false, fullName: "Meera Iyer" }));
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const result = await createLoanAssistanceEnquiry({
      draft: parsed.data,
      store,
      marketingConsentGranted: false,
    });
    assert.equal(result.status, "created");
    assert.equal(result.eventId, null);
    assert.equal(shouldEmitLoanAssistanceLead(result, false), false);
    assert.equal(store.rows[0]?.isTest, false);
  });
});

describe("loan assistance campaign copy and page view", () => {
  it("keeps unsupported claims out of the public enquiry copy", () => {
    const copy = `${LOAN_ASSISTANCE_INTRO}\n${LOAN_ASSISTANCE_SERVICE_SUMMARY}\n${ENQUIRY_FOLLOW_UP_CONSENT_TEXT}`;
    for (const pattern of [/guaranteed approval/i, /guaranteed disbursement/i, /assured interest/i, /₹99/, /aadhaar/i, /pan card/i, /all[- ]india branches/i]) {
      assert.equal(pattern.test(copy), false, pattern.source);
    }
  });

  it("sends PageView only for the home and loan-assistance paths", () => {
    assert.equal(isConsentPageViewPath("/"), true);
    assert.equal(isConsentPageViewPath("/loan-assistance"), true);
    assert.equal(isConsentPageViewPath("/apply/quick"), false);
    assert.equal(isConsentPageViewPath("/payment/success"), false);
  });

  it("builds instagram-only destination URLs without personal contact details", () => {
    const first = loanAssistanceDestination("assist_a");
    const second = loanAssistanceDestination("assist_b");
    assert.equal(first, "https://www.vploanconnect.in/loan-assistance?utm_source=instagram&utm_medium=paid_social&utm_campaign=ig_loan_assistance_5d&utm_content=assist_a");
    assert.equal(second.includes("utm_content=assist_b"), true);
    assert.equal(first.includes("@"), false);
    const readme = readFileSync(path.join(process.cwd(), "marketing/campaigns/ig-loan-assistance/README.md"), "utf8");
    assert.equal(readme.includes(first), true);
    assert.equal(readme.includes(second), true);
    assert.equal(readme.includes("Ads live: no"), true);
  });
});

describe("instagram creative dimensions", () => {
  it("matches the documented feed and stories-reels sizes", () => {
    const root = path.join(process.cwd(), "marketing/campaigns/ig-loan-assistance/creatives");
    const expected: Record<string, [number, number]> = {
      "concept-a-feed-4x5.png": [1440, 1800],
      "concept-a-stories-reels-9x16.png": [1440, 2560],
      "concept-b-feed-4x5.png": [1440, 1800],
      "concept-b-stories-reels-9x16.png": [1440, 2560],
    };
    for (const [file, [width, height]] of Object.entries(expected)) {
      const buffer = readFileSync(path.join(root, file));
      assert.equal(buffer.readUInt32BE(16), width, file);
      assert.equal(buffer.readUInt32BE(20), height, file);
    }
  });
});
