import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canAccessPaidReport } from "./access";

describe("paid report access", () => {
  it("requires paid status, matching subject and an unexpired link", () => { const reportId = "report-1"; const future = new Date(Date.now() + 10000); assert.equal(canAccessPaidReport({ orderStatus: "PAID", reportId, tokenSubject: reportId, expiresAt: future }), true); assert.equal(canAccessPaidReport({ orderStatus: "PENDING", reportId, tokenSubject: reportId, expiresAt: future }), false); assert.equal(canAccessPaidReport({ orderStatus: "PAID", reportId, tokenSubject: "other", expiresAt: future }), false); assert.equal(canAccessPaidReport({ orderStatus: "PAID", reportId, tokenSubject: reportId, expiresAt: new Date(0) }), false); });
});
