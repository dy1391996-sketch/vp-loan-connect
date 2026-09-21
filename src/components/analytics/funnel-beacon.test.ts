import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { funnelEventStorageKey } from "@/components/analytics/funnel-beacon";

describe("funnel event dedupe keys", () => {
  it("keeps order references and strips characters that are unsafe in storage keys", () => {
    assert.equal(funnelEventStorageKey("payment_VPLC-1001"), "vplc_evt_payment_VPLC-1001");
    assert.equal(funnelEventStorageKey("payfail_abc token?"), "vplc_evt_payfail_abctoken");
  });
});
