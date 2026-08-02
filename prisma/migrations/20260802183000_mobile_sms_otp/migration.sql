-- Mobile SMS OTP hardening: resend tracking + admin verification method.
-- Additive only — does not delete existing user/lead data.

ALTER TABLE "Lead" ADD COLUMN "mobileVerificationMethod" VARCHAR(32);

ALTER TABLE "OtpRequest" ADD COLUMN "resendCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OtpRequest" ADD COLUMN "lastSentAt" TIMESTAMP(3);

UPDATE "OtpRequest" SET "lastSentAt" = "createdAt" WHERE "lastSentAt" IS NULL;

ALTER TABLE "OtpRequest" ALTER COLUMN "lastSentAt" SET NOT NULL;
ALTER TABLE "OtpRequest" ALTER COLUMN "lastSentAt" SET DEFAULT CURRENT_TIMESTAMP;
