import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POST as otpRequest } from "@/app/api/otp/request/route";
import { POST as mobileSendOtp } from "@/app/api/mobile/send-otp/route";
import { POST as mobileVerifyOtp } from "@/app/api/mobile/verify-otp/route";

describe("SMS OTP endpoints remain disabled", () => {
  it("returns 410 for legacy OTP and mobile SMS routes", async () => {
    const [otp, send, verify] = await Promise.all([otpRequest(), mobileSendOtp(), mobileVerifyOtp()]);
    assert.equal(otp.status, 410);
    assert.equal(send.status, 410);
    assert.equal(verify.status, 410);
    const body = await otp.json();
    assert.equal(body.code, "SMS_OTP_REMOVED");
  });
});
