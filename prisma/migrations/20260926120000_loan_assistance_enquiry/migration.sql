-- Instagram loan-assistance enquiries. Additive only — does not change payment or assessment tables.

CREATE TABLE "LoanAssistanceEnquiry" (
    "id" UUID NOT NULL,
    "publicRef" VARCHAR(16) NOT NULL,
    "fullName" VARCHAR(120) NOT NULL,
    "mobile" VARCHAR(16) NOT NULL,
    "city" VARCHAR(80) NOT NULL,
    "state" VARCHAR(80) NOT NULL,
    "loanType" VARCHAR(80) NOT NULL,
    "consentVersion" VARCHAR(40) NOT NULL,
    "followUpConsentAt" TIMESTAMP(3) NOT NULL,
    "source" VARCHAR(120) NOT NULL,
    "utm" JSONB,
    "clientSubmissionKey" VARCHAR(64) NOT NULL,
    "metaEventId" VARCHAR(50),
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanAssistanceEnquiry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LoanAssistanceEnquiry_publicRef_key" ON "LoanAssistanceEnquiry"("publicRef");
CREATE UNIQUE INDEX "LoanAssistanceEnquiry_clientSubmissionKey_key" ON "LoanAssistanceEnquiry"("clientSubmissionKey");
CREATE UNIQUE INDEX "LoanAssistanceEnquiry_metaEventId_key" ON "LoanAssistanceEnquiry"("metaEventId");
CREATE INDEX "LoanAssistanceEnquiry_mobile_createdAt_idx" ON "LoanAssistanceEnquiry"("mobile", "createdAt");
CREATE INDEX "LoanAssistanceEnquiry_isTest_createdAt_idx" ON "LoanAssistanceEnquiry"("isTest", "createdAt");
CREATE INDEX "LoanAssistanceEnquiry_loanType_idx" ON "LoanAssistanceEnquiry"("loanType");
