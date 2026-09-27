import { hasMarketingConsent } from "@/lib/consent/marketing-consent";
import { trackMetaPixelEvent } from "@/lib/meta/pixel-client";

/**
 * Browser Lead pixel only. The server already sent Conversions API with the same event id
 * after the enquiry row was stored. Do not call this on button click, validation failure,
 * duplicate acknowledgement, or a thank-you refresh.
 */
export function emitLoanAssistanceBrowserLead(input: {
  status: "created" | "duplicate";
  eventId: string | null;
  loanType: string;
}): boolean {
  if (input.status !== "created" || !input.eventId) return false;
  if (!hasMarketingConsent()) return false;
  const tracked = trackMetaPixelEvent("LoanAssistanceEnquiry", {
    eventId: input.eventId,
    params: { content_category: input.loanType },
  });
  return Boolean(tracked);
}
