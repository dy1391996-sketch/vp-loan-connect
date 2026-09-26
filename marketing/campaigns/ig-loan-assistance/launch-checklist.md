# Launch checklist — IG Loan Assistance 5-day

Use this in Ads Manager. Do not mark an item done from this file alone.

## Before spending

- [ ] Portfolio VP Loan Connect can create ads. A restriction on advertising, Events Manager or pixel creation blocks launch.
- [ ] Instagram identity selected in the ad is @vploanconnect, not a personal profile and not an older handle.
- [ ] Destination is the Variant A or Variant B loan-assistance URL in `README.md`.
- [ ] The page shows the enquiry form, the lender qualifier, and no request for Aadhaar, PAN, bank details or documents.
- [ ] A test enquiry saved with the `[VPLC-TEST]` name prefix is visible in Admin → Ad enquiries and is labelled TEST.
- [ ] Marketing consent off: form still saves, and no Lead event is sent.
- [ ] Marketing consent on: one Lead uses the `eventId` returned for a new row. A second submit of the same mobile does not return a new `eventId`.
- [ ] Pixel and Conversions API use the authorized dataset. Do not invent an id. A rejected access token means Lead delivery is not verified.
- [ ] Placements are Instagram Feed, Stories and Reels only.
- [ ] One ad set, India, age 18–65+, all genders, no lookalikes.
- [ ] Ad set daily budget ₹300. Advantage+ campaign budget off. Campaign spending limit ₹1,500.
- [ ] Start time is the actual launch time. End time is exactly five days later. Time zone Asia/Kolkata.
- [ ] Both ads use Learn More, the shared headline, the qualifier, and the matching creative files.
- [ ] ₹99 Credit Profile Booster is not the ad offer, headline or primary button.
- [ ] Payment method and any GST, TDS or payment-method charge are visible on the billing page and are not treated as part of the ₹1,500 spend cap.

## After publish

- [ ] Ads Manager shows the campaign in the intended account, with Instagram-only placements and the spending limit.
- [ ] The first live click opens `/loan-assistance` with the variant `utm_content`.
- [ ] Only then can the status change from “Campaign draft ready” to “Ads live”.
