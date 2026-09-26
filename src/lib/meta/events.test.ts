import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FIRST_PARTY_TO_META,
  META_FUNNEL_EVENTS,
  createMetaEventId,
  isMetaFunnelEvent,
  metaBrowserTrackMethod,
  metaPixelEventName,
} from "@/lib/meta/events";
import { buildCapIPayload, getMetaCapiConfig, sendMetaCapiEvent } from "@/lib/meta/capi";


describe("Meta funnel events", () => {
  it("includes the expected VP Loan Connect funnel catalog", () => {
    for (const name of [
      "LandingPageView",
      "QuickApplyStarted",
      "OTPVerified",
      "AssessmentCompleted",
      "EligibilityViewed",
      "CheckoutStarted",
      "PaymentSuccess",
      "PaymentFailed",
      "Purchase",
      "InstagramProfileClick",
      "InstagramAdLanding",
      "LoanAssistanceEnquiry",
    ]) {
      assert.equal(isMetaFunnelEvent(name), true);
      assert.ok(META_FUNNEL_EVENTS.includes(name as (typeof META_FUNNEL_EVENTS)[number]));
    }
  });

  it("maps first-party funnel events for Pixel/CAPI", () => {
    // LandingPageView is provider-owned after consent (not mapped from homepage_visit).
    assert.equal(FIRST_PARTY_TO_META.homepage_visit, undefined);
    assert.deepEqual(FIRST_PARTY_TO_META.email_verified, ["OTPVerified"]);
    assert.deepEqual(FIRST_PARTY_TO_META.checkout_opened, ["CheckoutStarted"]);
    assert.deepEqual(FIRST_PARTY_TO_META.payment_completed, ["PaymentSuccess"]);
    assert.deepEqual(FIRST_PARTY_TO_META.payment_failed, ["PaymentFailed"]);
    assert.deepEqual(FIRST_PARTY_TO_META.instagram_profile_click, ["InstagramProfileClick"]);
  });

  it("creates stable-length dedupe event ids", () => {
    const a = createMetaEventId("payment");
    const b = createMetaEventId("payment");
    assert.notEqual(a, b);
    assert.ok(a.startsWith("vplc_"));
    assert.ok(a.length <= 50);
    assert.ok(b.length <= 50);
  });

  it("maps each funnel stage to a distinct Meta event", () => {
    assert.equal(metaPixelEventName("PaymentSuccess"), "Purchase");
    assert.equal(metaPixelEventName("LandingPageView"), "PageView");
    assert.equal(metaPixelEventName("QuickApplyStarted"), "QuickApplyStarted");
    assert.equal(metaPixelEventName("OTPVerified"), "CompleteRegistration");
    assert.equal(metaPixelEventName("AssessmentCompleted"), "SubmitApplication");
    assert.equal(metaPixelEventName("EligibilityViewed"), "ViewContent");
    assert.equal(metaPixelEventName("CheckoutStarted"), "InitiateCheckout");
    assert.equal(metaPixelEventName("PaymentFailed"), "PaymentFailed");
    assert.equal(metaPixelEventName("LoanAssistanceEnquiry"), "Lead");
    assert.equal(metaBrowserTrackMethod(metaPixelEventName("LoanAssistanceEnquiry")), "track");
    const names = (["QuickApplyStarted", "OTPVerified", "AssessmentCompleted"] as const).map((event) => metaPixelEventName(event));
    assert.equal(new Set(names).size, 3);
    assert.equal(names.includes("Lead"), false);
  });

  it("uses trackCustom for non-standard Pixel names", () => {
    assert.equal(metaBrowserTrackMethod("Purchase"), "track");
    assert.equal(metaBrowserTrackMethod("CompleteRegistration"), "track");
    assert.equal(metaBrowserTrackMethod("QuickApplyStarted"), "trackCustom");
    assert.equal(metaBrowserTrackMethod("PaymentFailed"), "trackCustom");
  });
});

describe("Meta CAPI readiness", () => {
  it("returns null config when Meta vars are missing (fail open)", () => {
    assert.equal(getMetaCapiConfig({}), null);
    assert.equal(getMetaCapiConfig({ NEXT_PUBLIC_META_PIXEL_ID: "123" }), null);
  });

  it("builds a dedupe-ready payload with hashed email when configured", () => {
    const config = getMetaCapiConfig({
      NEXT_PUBLIC_META_PIXEL_ID: "pixel-1",
      META_CAPI_ACCESS_TOKEN: "token-1",
      META_TEST_EVENT_CODE: "TEST123",
    });
    assert.ok(config);
    const payload = buildCapIPayload(
      {
        eventName: "PaymentSuccess",
        eventId: "vplc_pay_abc123",
        eventSourceUrl: "https://www.vploanconnect.in/checkout",
        userData: { email: "User@Example.com" },
        customData: { currency: "INR", value: 116.82 },
      },
      config!,
    );
    assert.equal(payload.data[0].event_name, "Purchase");
    assert.equal(payload.data[0].event_id, "vplc_pay_abc123");
    assert.equal(payload.test_event_code, "TEST123");
    assert.ok(payload.data[0].user_data.em?.[0]);
    assert.notEqual(payload.data[0].user_data.em?.[0], "User@Example.com");
    assert.equal(payload.data[0].custom_data?.currency, "INR");
    assert.equal(payload.data[0].custom_data?.value, 116.82);
  });

  it("maps a confirmed loan-assistance enquiry to one Lead and hashes the phone", () => {
    const config = getMetaCapiConfig({
      NEXT_PUBLIC_META_PIXEL_ID: "pixel-1",
      META_CAPI_ACCESS_TOKEN: "token-1",
    });
    assert.ok(config);
    const payload = buildCapIPayload(
      {
        eventName: "LoanAssistanceEnquiry",
        eventId: "vplc_lead_abc",
        eventSourceUrl: "https://www.vploanconnect.in/loan-assistance",
        userData: { phone: "+919812345670" },
        customData: { content_category: "Personal loan", lead_source: "instagram_loan_assistance" },
      },
      config!,
    );
    assert.equal(payload.data[0].event_name, "Lead");
    assert.equal(payload.data[0].event_id, "vplc_lead_abc");
    assert.equal(payload.data[0].custom_data?.content_category, "Personal loan");
    assert.equal(JSON.stringify(payload).includes("9812345670"), false);
    assert.equal(JSON.stringify(payload).includes("token-1"), false);
  });

  it("surfaces sanitized Meta OAuth 190 fields without exposing the token", async () => {
    const result = await sendMetaCapiEvent(
      {
        eventName: "LandingPageView",
        eventId: "vplc_landing_diag01",
        eventSourceUrl: "https://www.vploanconnect.in/",
      },
      {
        environment: {
          NODE_ENV: "test",
          NEXT_PUBLIC_META_PIXEL_ID: "1057590634424945",
          META_CAPI_ACCESS_TOKEN: "secret-token-must-not-leak",
        },
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              error: {
                message: "Invalid OAuth access token - Cannot parse access token",
                type: "OAuthException",
                code: 190,
                fbtrace_id: "TRACEONLY",
              },
            }),
            { status: 400, headers: { "content-type": "application/json" } },
          ),
      },
    );
    assert.equal(result.sent, false);
    assert.equal(result.reason, "provider_auth_rejected");
    assert.equal(result.status, 400);
    assert.equal(result.meta?.code, 190);
    assert.equal(result.meta?.type, "OAuthException");
    assert.equal(result.meta?.fbtrace_id, "TRACEONLY");
    assert.match(String(result.meta?.message), /Invalid OAuth access token/i);
    assert.equal(JSON.stringify(result).includes("secret-token-must-not-leak"), false);
  });
});
