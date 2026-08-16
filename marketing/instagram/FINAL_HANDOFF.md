# FINAL HANDOFF — Organic Instagram @vploanconnect.in

Date (UTC): 2026-08-16  
Branch: `cursor/instagram-organic-setup-bf91`  
Ads / Pixel / CAPI / billing / Boost: **UNTOUCHED**

## Profile — target vs verified

| Field | Target | Actual |
| --- | --- | --- |
| Username | @vploanconnect.in (Production SoT; master prompt’s `@vploanconnect` superseded by live Production) | **@vploanconnect.in** |
| Display name | VP Loan Connect \| Loan Assistance | Verified |
| Category | Financial service | Verified |
| Bio | Approved 3-line bio | Verified |
| Website | https://www.vploanconnect.in | Verified |
| WhatsApp / Call / phone | Off / hidden | Verified |
| Profile photo | VP monogram 1080×1080 | Uploaded |

Evidence: `/opt/cursor/artifacts/ig_profile_verified.webp`, `ig_profile_bio_updated.webp`, `ig_posts_01_02_35_published.webp`

## Published (organic web)

| Post | Topic | Status |
| --- | --- | --- |
| 01 | Brand Introduction — Clear Guidance… | **Published** |
| 02 | Why Choose VP Loan Connect | **Published** |
| 35 | Start Your Secure Enquiry | **Published** |
| 03–34, 36 | Remaining educational set | Rendered + queued (not bulk-published to avoid spam burst) |

## Pins & highlights

| Item | Status |
| --- | --- |
| Pin 01, 02, 35 | **MANUAL ACTION REQUIRED** — Instagram web (desktop + mobile web) has no Pin control |
| Highlights (7) | **MANUAL ACTION REQUIRED** — requires native app Stories → Highlights |
| Story/cover files | Ready under `marketing/instagram/stories/` and `highlights/` |

### Owner mobile-app steps (exact)

1. Open Instagram **app** → @vploanconnect.in  
2. Pin in any order until all three show pin badges:  
   - “Clear Guidance. Smarter Loan Decisions.” (**01**)  
   - “Why people start with VP Loan Connect” (**02**)  
   - “Start your secure enquiry today” (**35**)  
3. Create Stories from `marketing/instagram/stories/*-1080x1920.png`  
4. Add Highlights with covers from `marketing/instagram/highlights/*.png` (Reviews = neutral only; no fake testimonials)

## Local factory

- 36× 1080×1350 feed PNGs + captions + alt + meta  
- Profile DP, 7 highlight covers, 7 stories, 6 reel packages  
- `metadata/posts_master.csv`, `30_day_calendar.csv|md`, `publishing_status.csv`  
- Validator: `VALIDATION_OK 36`  
- Compliance report: `audit/content_compliance_report.md`

## Remaining

- Owner: pin 01/02/35 + stories/highlights on mobile app  
- Agent later: continue organic publish cadence from calendar (posts 03+) without Boost  
- Do not use legacy parked handle for Production CTA; keep website → @vploanconnect.in

## Explicit confirmation

**No Ads Manager, ad account, campaign, budget, billing, Pixel, CAPI, attribution, or Boost Post settings were opened or changed in this run.**
