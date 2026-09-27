import { randomBytes } from "node:crypto";
import { LOAN_ASSISTANCE_DUPLICATE_WINDOW_MS } from "@/lib/loan-assistance/constants";
import type { NormalizedLoanAssistanceEnquiry } from "@/lib/loan-assistance/validation";
import { createMetaEventId } from "@/lib/meta/events";

const PUBLIC_REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type StoredLoanAssistanceEnquiry = {
  id: string;
  publicRef: string;
  fullName: string;
  mobile: string;
  city: string;
  state: string;
  loanType: string;
  clientSubmissionKey: string;
  metaEventId: string | null;
  isTest: boolean;
  createdAt: Date;
};

export type EnquirySaveInput = {
  draft: NormalizedLoanAssistanceEnquiry;
  since: Date;
  now: Date;
  publicRef: string;
  eventId: string | null;
};

export type EnquiryStore = {
  save(input: EnquirySaveInput): Promise<{ record: StoredLoanAssistanceEnquiry; created: boolean }>;
};

export type LoanAssistanceSubmitResult = {
  status: "created" | "duplicate";
  reference: string;
  eventId: string | null;
  isTest: boolean;
};

export function createPublicRef(): string {
  const bytes = randomBytes(8);
  let ref = "LA";
  for (let index = 0; index < 8; index += 1) {
    ref += PUBLIC_REF_ALPHABET[bytes[index] % PUBLIC_REF_ALPHABET.length];
  }
  return ref;
}

/**
 * Lead measurement is allowed only for a newly stored enquiry when marketing consent was granted.
 * Duplicates, failed validation and a thank-you refresh must not receive a new event id.
 */
export function shouldEmitLoanAssistanceLead(result: Pick<LoanAssistanceSubmitResult, "status" | "eventId">, marketingConsent: boolean): boolean {
  return result.status === "created" && marketingConsent && Boolean(result.eventId);
}

export async function createLoanAssistanceEnquiry(input: {
  draft: NormalizedLoanAssistanceEnquiry;
  store: EnquiryStore;
  now?: Date;
  marketingConsentGranted: boolean;
}): Promise<LoanAssistanceSubmitResult> {
  const now = input.now ?? new Date();
  const track = input.marketingConsentGranted && input.draft.marketingConsent;
  const saved = await input.store.save({
    draft: input.draft,
    since: new Date(now.getTime() - LOAN_ASSISTANCE_DUPLICATE_WINDOW_MS),
    now,
    publicRef: createPublicRef(),
    eventId: track ? createMetaEventId("lead") : null,
  });
  return {
    status: saved.created ? "created" : "duplicate",
    reference: saved.record.publicRef,
    eventId: saved.created ? saved.record.metaEventId : null,
    isTest: saved.record.isTest,
  };
}
