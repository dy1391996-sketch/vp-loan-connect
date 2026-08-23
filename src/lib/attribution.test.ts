import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildAssessmentEntryHref,
  buildPartnerHandoffUrl,
  mergeAttribution,
  pickAttribution,
} from "./attribution";

describe("attribution", () => {
  it("picks partnership-style deep-link params including click ids", () => {
    const params = new URLSearchParams(
      "utm_content=BNOOV1&c=partnership&af_xp=custom&af_reengagement_window=30d&utm_campaign=switchmyloan_22_oct&is_retargeting=true&pid=Switchmyloan_PA_22Oct&utm_source=partnership&utm_id=cmp_1&fbclid=abc&gclid=xyz"
    );
    const picked = pickAttribution(params);
    assert.equal(picked.utm_source, "partnership");
    assert.equal(picked.pid, "Switchmyloan_PA_22Oct");
    assert.equal(picked.c, "partnership");
    assert.equal(picked.af_xp, "custom");
    assert.equal(picked.is_retargeting, "true");
    assert.equal(picked.utm_campaign, "switchmyloan_22_oct");
    assert.equal(picked.utm_id, "cmp_1");
    assert.equal(picked.fbclid, "abc");
    assert.equal(picked.gclid, "xyz");
  });

  it("merges newer attribution over older values", () => {
    const merged = mergeAttribution(
      { utm_source: "direct", pid: "OldPartner" },
      { utm_source: "partnership", utm_campaign: "pl_launch" }
    );
    assert.equal(merged.utm_source, "partnership");
    assert.equal(merged.pid, "OldPartner");
    assert.equal(merged.utm_campaign, "pl_launch");
  });

  it("builds assessment entry with personal-loan prefills", () => {
    const href = buildAssessmentEntryHref({
      loanType: "PERSONAL",
      amount: 100000,
      purpose: "Other personal need",
      attribution: { utm_source: "partnership", pid: "Partner_PA" },
    });
    assert.match(href, /^\/apply\/quick\?/);
    assert.match(href, /loanType=PERSONAL/);
    assert.match(href, /amount=100000/);
    assert.match(href, /utm_source=partnership/);
    assert.match(href, /pid=Partner_PA/);
  });

  it("appends attribution to outbound partner handoff URLs", () => {
    const href = buildPartnerHandoffUrl("https://loans.apps.herofincorp.com/en/personal-loan", {
      utm_source: "vploanconnect",
      utm_campaign: "personal_loan",
      pid: "VP_PA_PL",
    });
    const url = new URL(href);
    assert.equal(url.origin, "https://loans.apps.herofincorp.com");
    assert.equal(url.searchParams.get("utm_source"), "vploanconnect");
    assert.equal(url.searchParams.get("utm_campaign"), "personal_loan");
    assert.equal(url.searchParams.get("pid"), "VP_PA_PL");
    assert.equal(url.searchParams.get("utm_medium"), "referral");
  });
});
