import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { EnquirySaveInput, EnquiryStore, StoredLoanAssistanceEnquiry } from "@/lib/loan-assistance/service";

function toStored(row: {
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
}): StoredLoanAssistanceEnquiry {
  return {
    id: row.id,
    publicRef: row.publicRef,
    fullName: row.fullName,
    mobile: row.mobile,
    city: row.city,
    state: row.state,
    loanType: row.loanType,
    clientSubmissionKey: row.clientSubmissionKey,
    metaEventId: row.metaEventId,
    isTest: row.isTest,
    createdAt: row.createdAt,
  };
}

export const prismaEnquiryStore: EnquiryStore = {
  async save(input: EnquirySaveInput) {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.draft.mobile}))`;
      const byKey = await tx.loanAssistanceEnquiry.findUnique({
        where: { clientSubmissionKey: input.draft.clientSubmissionKey },
      });
      if (byKey) return { record: toStored(byKey), created: false as const };
      const byMobile = await tx.loanAssistanceEnquiry.findFirst({
        where: { mobile: input.draft.mobile, createdAt: { gte: input.since } },
        orderBy: { createdAt: "desc" },
      });
      if (byMobile) return { record: toStored(byMobile), created: false as const };
      const created = await tx.loanAssistanceEnquiry.create({
        data: {
          publicRef: input.publicRef,
          fullName: input.draft.fullName,
          mobile: input.draft.mobile,
          city: input.draft.city,
          state: input.draft.state,
          loanType: input.draft.loanType,
          consentVersion: input.draft.consentVersion,
          followUpConsentAt: input.now,
          source: input.draft.source,
          utm: input.draft.utm ?? Prisma.JsonNull,
          clientSubmissionKey: input.draft.clientSubmissionKey,
          metaEventId: input.eventId,
          isTest: input.draft.isTest,
          createdAt: input.now,
        },
      });
      return { record: toStored(created), created: true as const };
    });
  },
};
