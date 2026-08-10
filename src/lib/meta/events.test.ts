import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FIRST_PARTY_TO_META,
  META_FUNNEL_EVENTS,
  createMetaEventId,
  isMetaFunnelEvent,
  metaPixelEventName,
} from "@/lib/meta/events";
import { buildCapIPayload, getMetaCapiConfig } from "@/lib/meta/capi";

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
      "Purchase",
      "InstagramProfileClick",
      "InstagramAdLanding",
    ]) {
      assert.equal(isMetaFunnelEvent(name), true);
      assert.ok(META_FUNNEL_EVENTS.includes(name as (typeof META_FUNNEL_EVENTS)[number]));
    }
  });

  it("maps first-party funnel events for Pixel/CAPI", () => {
    assert.deepEqual(FIRST_PARTY_TO_META.homepage_visit, ["LandingPageView"]);
    assert.deepEqual(FIRST_PARTY_TO_META.email_verified, ["OTPVerified"]);
    assert.deepEqual(FIRST_PARTY_TO_META.checkout_opened, ["CheckoutStarted"]);
    assert.deepEqual(FIRST_PARTY_TO_META.payment_completed, ["PaymentSuccess"]);
  });

  it("creates stable-length dedupe event ids", () => {
    const a = createMetaEventId("payment");
    const b = createMetaEventId("payment");
    assert.notEqual(a, b);
    assert.ok(a.startsWith("vplc_"));
    assert.ok(a.length <= 50);
    assert.ok(b.length <= 50);
  });

  it("maps PaymentSuccess to standard Purchase for Meta", () => {
    assert.equal(metaPixelEventName("PaymentSuccess"), "Purchase");
    assert.equal(metaPixelEventName("LandingPageView"), "PageView");
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
});
