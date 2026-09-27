import type { EnquirySaveInput, EnquiryStore, StoredLoanAssistanceEnquiry } from "@/lib/loan-assistance/service";

export function createMemoryEnquiryStore(): EnquiryStore & { rows: StoredLoanAssistanceEnquiry[] } {
  const rows: StoredLoanAssistanceEnquiry[] = [];
  return {
    rows,
    async save(input: EnquirySaveInput) {
      const byKey = rows.find((row) => row.clientSubmissionKey === input.draft.clientSubmissionKey);
      if (byKey) return { record: byKey, created: false };
      const byMobile = rows.find((row) => row.mobile === input.draft.mobile && row.createdAt >= input.since);
      if (byMobile) return { record: byMobile, created: false };
      const record: StoredLoanAssistanceEnquiry = {
        id: `mem-${rows.length + 1}`,
        publicRef: input.publicRef,
        fullName: input.draft.fullName,
        mobile: input.draft.mobile,
        city: input.draft.city,
        state: input.draft.state,
        loanType: input.draft.loanType,
        clientSubmissionKey: input.draft.clientSubmissionKey,
        metaEventId: input.eventId,
        isTest: input.draft.isTest,
        createdAt: input.now,
      };
      rows.push(record);
      return { record, created: true };
    },
  };
}
