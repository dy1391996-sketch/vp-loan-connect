/**
 * Ready-to-enter Instagram campaign settings.
 * Dates are not stored here: set the start to the actual launch time.
 */

export const CAMPAIGN_NAME = "IG Loan Assistance 5-day";
export const CAMPAIGN_DAILY_BUDGET_INR = 300;
export const CAMPAIGN_SPENDING_LIMIT_INR = 1500;
export const CAMPAIGN_LENGTH_DAYS = 5;
export const CAMPAIGN_DESTINATION_ORIGIN = "https://www.vploanconnect.in";
export const CAMPAIGN_UTM = {
  utm_source: "instagram",
  utm_medium: "paid_social",
  utm_campaign: "ig_loan_assistance_5d",
} as const;

export const CAMPAIGN_AD_CONTENTS = ["assist_a", "assist_b"] as const;
export type CampaignAdContent = (typeof CAMPAIGN_AD_CONTENTS)[number];

export function loanAssistanceDestination(content: CampaignAdContent): string {
  const url = new URL("/loan-assistance", CAMPAIGN_DESTINATION_ORIGIN);
  url.searchParams.set("utm_source", CAMPAIGN_UTM.utm_source);
  url.searchParams.set("utm_medium", CAMPAIGN_UTM.utm_medium);
  url.searchParams.set("utm_campaign", CAMPAIGN_UTM.utm_campaign);
  url.searchParams.set("utm_content", content);
  return url.toString();
}
