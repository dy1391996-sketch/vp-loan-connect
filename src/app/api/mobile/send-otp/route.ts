import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** SMS OTP has been removed. Use email OTP via /api/otp/verify. */
export async function POST() {
  return NextResponse.json(
    {
      error: "SMS OTP is no longer supported. Verify with email OTP instead.",
      code: "SMS_OTP_REMOVED",
    },
    { status: 410 },
  );
}
