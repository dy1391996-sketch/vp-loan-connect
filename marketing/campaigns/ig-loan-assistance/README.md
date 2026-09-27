# VP Loan Connect — Instagram loan-assistance campaign package

**Ads live: no.** This package is ready to enter in Meta Ads Manager. It was not published, and this environment has no authorized Meta Ads API session that can create the campaign in the VP Loan Connect ad account.

| Item | Value |
| --- | --- |
| Brand | VP Loan Connect |
| Instagram identity to select | @vploanconnect |
| Destination | Website enquiry form |
| Geography | India (ad targeting only) |
| Duration | 5 × 24 hours from the actual launch time |
| Ad set daily budget | ₹300 |
| Campaign spending limit | ₹1,500 advertising spend |
| Placements | Instagram Feed, Instagram Stories, Instagram Reels |
| Offer excluded | ₹99 Credit Profile Booster / Loan Match & Readiness Report |

## Status labels

| Status | Actual state |
| --- | --- |
| Website ready | After this change is deployed and the loan-assistance migration has run |
| Campaign draft ready | Yes — settings, copy and image assets in this folder |
| Ads live | No |

## Destination URLs

Do not add a phone number, email address or name to these URLs.

Variant A:

https://www.vploanconnect.in/loan-assistance?utm_source=instagram&utm_medium=paid_social&utm_campaign=ig_loan_assistance_5d&utm_content=assist_a

Variant B:

https://www.vploanconnect.in/loan-assistance?utm_source=instagram&utm_medium=paid_social&utm_campaign=ig_loan_assistance_5d&utm_content=assist_b

Leave `utm_id` empty until Ads Manager assigns a campaign id. Do not invent one.

## Campaign structure

One campaign. One ad set. Two ads. Do not split ₹300/day across extra ad sets.

| Level | Setting |
| --- | --- |
| Campaign name | IG Loan Assistance 5-day |
| Objective | Leads (`OUTCOME_LEADS`) |
| Conversion location | Website |
| Special ad category | See the category note below |
| Advantage+ campaign budget | Off, so a campaign spending limit stays available |
| Campaign spending limit | ₹1,500 |
| Ad set name | IN website enquiry |
| Budget | Ad set daily budget ₹300 |
| Schedule | Start = actual launch timestamp in Asia/Kolkata. End = start + 5 × 24 hours. Do not reuse a past date. |
| Location | India |
| Age | 18–65+ |
| Gender | All |
| Detailed targeting | None. Do not add interest stacks on this budget. |
| Lookalikes | Off |
| Placements | Manual: Instagram Feed, Stories, Reels only. Do not add Facebook, Messenger, Audience Network or Threads. |
| Optimization | Website Lead event |
| Billing | Impressions, as offered for this objective |
| Pixel | The dataset already configured for www.vploanconnect.in. Do not type a new id. |

If the ad account cannot optimize for a website Lead event, stop and use the owner action list. Do not switch the destination to an instant form or a Facebook placement.

### Why the spending limit is the ceiling

Meta’s daily budget is not a hard cap. Official help says delivery can spend up to 75% over the daily budget on a day (175% of that day’s budget) and up to seven times the daily budget across a Sunday–Saturday week. Sources: [About daily budgets](https://www.facebook.com/business/help/190490051321426) and [About campaign spending limits](https://www.facebook.com/business/help/481733105308636).

A campaign spending limit stops every ad in the campaign when spend reaches the limit. With Advantage+ campaign budget left off, set that limit to ₹1,500. A lifetime budget is not the primary setup. If the account forces a lifetime budget instead, the amount is still ₹1,500 over the same five-day end time, and daily delivery can vary inside that total.

₹1,500 is advertising spend only.

### Taxes and payment charges (not inside ₹1,500)

For an India sold-to address billed by Facebook India, Meta adds GST and TDS at the applicable local rate on the ad purchase. Confirm the exact lines on the ad-account receipt. Sources: [About India's GST](https://www.facebook.com/business/help/1273346946097087) and [Taxes on Meta ads placement](https://www.facebook.com/business/help/133076073434794).

Payment-method charges, if any, are also separate. Do not guess a card or UPI fee. Add a GSTIN in Payment settings only from the verified business registration.

## Category, verification and targeting

Loan assistance is information and application-preparation guidance. VP Loan Connect is not a lender. Copy must not promise approval, disbursement, an interest rate or a credit-score change.

Meta’s developer documentation requires the Financial products and services special ad category for advertisers based in the United States or showing ads to audiences in the United States, and says the credit-ad rules continue for the US, Canada and certain parts of Europe. Source: [Special Ad Categories](https://developers.facebook.com/docs/marketing-api/audiences/special-ad-category/). This campaign targets India only, so that US requirement is not, by itself, the India rule.

In Ads Manager:

- If the account flags this loan creative as Financial products and services or Credit, select **Financial products and services**, country India, age 18–65+, all genders, no lookalike, no location exclusion.
- If the account does not require that category for an India-only campaign, leave the category as None only when the in-product check allows the ad.
- The June 2025 securities and investments verification (SEBI registration or an exemption, with beneficiary and payer disclosed) applies to securities and investments ads, not to this loan-assistance enquiry. Source: [Meta developer post, 26 June 2025](https://developers.facebook.com/blog/post/2025/06/26/verification-and-transparency-requirements-for-advertisers-targeting-users-in-india-with-securities-and-investments-ads/). If Ads Manager still asks for an authorization, complete that prompt. Do not bypass it.

Do not claim on-ground service in every Indian city. India is the ad-set location, not a coverage promise.

## Ad copy

Both ads use CTA **Learn More** and this description:

Loan approval, interest rate and disbursement depend on the lender’s eligibility criteria, documentation, credit profile and internal policies. VP Loan Connect is not a lender.

Headline for both: **Loan Assistance | VP Loan Connect**

### Variant A — `assist_a`

Primary text:

Loan options samajhiye aur application ki taiyari kijiye. VP Loan Connect ke saath loan assistance ke liye enquiry submit karein.

Creative concept: understand loan options. Files:

- `creatives/concept-a-feed-4x5.png` — 1440×1800, Instagram Feed
- `creatives/concept-a-stories-reels-9x16.png` — 1440×2560, Instagram Stories and Reels

### Variant B — `assist_b`

Primary text:

Loan category aur application steps samajhiye. VP Loan Connect par enquiry submit karein.

Creative concept: prepare the application. Files:

- `creatives/concept-b-feed-4x5.png` — 1440×1800, Instagram Feed
- `creatives/concept-b-stories-reels-9x16.png` — 1440×2560, Instagram Stories and Reels

Feed specs checked for the Leads / Instagram Feed image placement: JPG or PNG, 4:5, recommended 1440×1800, headline recommendation 40 characters, primary-text recommendation 125 characters. Source: [Leads image specs, Instagram Feed](https://www.facebook.com/business/ads-guide/update/image/instagram-feed/outcome-leads). The headline is 34 characters. Variant A is the approved full sentence and is slightly over the 125-character recommendation; Variant B is the shorter alternative.

Stories and Reels use the 9:16 PNG. Recommended Reels image size is 1440×2560, with about 14% of the top, 35% of the bottom and 6% of each side kept free of essential text. Source: [Instagram Reels image specs](https://www.facebook.com/business/ads-guide/update/image/instagram-reels). Text on the vertical files sits inside that middle band. These are static images because no approved video footage exists. Upload the 9:16 file to both Stories and Reels.

Regenerate with:

```bash
node marketing/campaigns/ig-loan-assistance/scripts/render-creatives.mjs
```

## Events

| Event | When |
| --- | --- |
| PageView | Once per page load of `/loan-assistance`, only after marketing consent, shared `event_id` for Pixel and Conversions API |
| Lead | Only after the server stores a new enquiry and marketing consent is granted. Same `event_id` on the browser Pixel and the server Conversions API call |

Do not count the button click, a failed submit, a duplicate mobile, or a refresh of the thank-you state as a new lead.

## Performance report

Copy `performance-report-template.md` when the campaign has a real start time. Do not fill it with estimated results.

## Owner actions before any paid start

See `launch-checklist.md`. Paid activation still depends on Meta allowing the VP Loan Connect portfolio to advertise, a valid pixel token, the correct Instagram account, and a payment method.
