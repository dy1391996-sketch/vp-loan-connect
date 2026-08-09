import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractReqId,
  formatMsg91Error,
  getMsg91AccessToken,
  MSG91_EMAIL_RETRY_CHANNEL,
} from "./msg91-email-otp";

describe("msg91 email otp helpers", () => {
  it("extracts access tokens from common MSG91 shapes", () => {
    assert.equal(getMsg91AccessToken("plain-access-token-value"), "plain-access-token-value");
    assert.equal(getMsg91AccessToken({ message: "jwt-looking-token-here" }), "jwt-looking-token-here");
    assert.equal(getMsg91AccessToken({ data: { "access-token": "nested-access-token" } }), "nested-access-token");
  });

  it("extracts reqId from send responses", () => {
    assert.equal(extractReqId({ reqId: "abc123456" }), "abc123456");
    assert.equal(extractReqId({ data: { request_id: "req987654" } }), "req987654");
  });

  it("surfaces IPBlocked clearly", () => {
    assert.match(
      formatMsg91Error({ message: "IPBlocked", type: "error", code: "408" }, "fallback"),
      /normal browser/i,
    );
  });

  it("uses email retry channel 3", () => {
    assert.equal(MSG91_EMAIL_RETRY_CHANNEL, "3");
  });

  it("documents that prepareMsg91EmailOtp must poll instead of a fixed 50ms race", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./msg91-email-otp.ts", import.meta.url), "utf8"),
    );
    assert.match(source, /maxWaitMs = 4000/);
    assert.match(source, /setTimeout\(tick, 100\)/);
    assert.match(source, /exposeMethods: true/);
  });
});
