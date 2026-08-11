# VPLC Automation Status

## Issue / scope

- **Issue:** https://github.com/dy1391996-sketch/vp-loan-connect/issues/13
- **Note:** GitHub Issues API remains 403 (`issues=read` missing) for the automation GitHub App token — cannot read/comment on issues until Issues Read/Write is granted.

## Merged delivery

| PR | Commit | Purpose |
| --- | --- | --- |
| #15 | `b56cfeb…` | Public contact cleanup + consent-gated Meta Pixel/CAPI |
| #16 | `4eac54e…` | Fontsource CI reliability |
| #17 | `472e666…` | Runtime `/api/public-config` + Instagram/Pixel hydration |
| #18 | `5bf0a7e…` | CAPI provider rejection classification (OAuth vs param) |

Production main includes through **#18**.

## Vercel project (proven)

- **Team:** `dpk09` (dpk)
- **Project:** `vp-loan-connect`
- **DOMAIN_MATCH:** yes — aliases include `https://www.vploanconnect.in` and `https://vploanconnect.in`

## Production environment variable NAMES (no values)

| Name | Production |
| --- | --- |
| `NEXT_PUBLIC_INSTAGRAM_URL` | PRESENT |
| `NEXT_PUBLIC_META_PIXEL_ID` | PRESENT |
| `META_CAPI_PIXEL_ID` | PRESENT |
| `META_CAPI_ACCESS_TOKEN` | PRESENT (name only; **token currently invalid for Graph API**) |
| `META_TEST_EVENT_CODE` | ABSENT (optional) |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | ABSENT (optional) |

`META_CAPI_PIXEL_ID` is optional in code (falls back to `NEXT_PUBLIC_META_PIXEL_ID`).

## Production verification (runtime)

| Check | Status |
| --- | --- |
| Homepage /contact /apply/quick | 200 |
| Public phone / WhatsApp / Call CTAs | Absent |
| Instagram CTA `@vploanconnect` | Live (`https://www.instagram.com/vploanconnect/`) |
| `/api/public-config` Instagram | Configured |
| `/api/public-config` Pixel ID | Configured (len 16, Dataset `…4945`) |
| `/api/public-config` `metaCapiConfigured` | `true` (non-empty token present) |
| Public config secret leak | None (no CAPI token in public API) |
| Consent banner | Works (shows when consent storage cleared) |
| Pre-consent Meta network | PASS (no fbevents before Allow analytics) |
| Post-consent Pixel load | PASS (Pixel `1057590634424945`) |
| LandingPageView + `event_id` | Observed (browser/CAPI client path) |
| CAPI Graph delivery | **FAIL** — HTTP 400 OAuthException **190** (*Invalid OAuth access token — Cannot parse access token*) |
| Pricing constants ₹99 / ₹17.82 / ₹116.82 | Intact in source / apply & checkout UI |
| OTP / Cashfree | Not intentionally changed |

## Meta Business assets

| Asset | Status |
| --- | --- |
| Facebook Page **VP Loan Connect** | Created |
| Dataset/Pixel **VP Loan Connect Website** | Created — ID **1057590634424945** |
| Business Portfolio | **Incomplete / missing** — blocks admin CAPI token generation |
| Instagram @vploanconnect in Business Suite | Not connected yet (website CTA already live via env) |
| Ad campaigns / spend | None (not authorized) |

## Remaining owner-only blockers

1. **Create/finish Meta Business Portfolio** “VP Loan Connect” (email verification may be required for the business email used).
2. Ensure the logged-in user is **Business Admin/Developer**.
3. **Generate** a valid Conversions API access token for Dataset `1057590634424945` and **replace** `META_CAPI_ACCESS_TOKEN` in Vercel → Production.
4. Agent will then **Redeploy Production** and re-verify CAPI `sent:true`.
5. Optional: connect Instagram `@vploanconnect` inside Business Suite; grant GitHub App **Issues Read/Write** for Issue #13 comments.

Do **not** paste token values into chat.

## Exact next automatic action (after owner DONE)

1. Confirm `META_CAPI_ACCESS_TOKEN` still present (name only).
2. Redeploy Production for `dpk09/vp-loan-connect`.
3. Probe `/api/meta/conversions` — expect `sent:true` (not OAuth 190).
4. Re-verify consent + Pixel + matching `event_id`.
5. Update this doc + attempt Issue #13 comment if permissions fixed.

## Meta Business restriction (2026-08-11 evening)

- Business Portfolio **VP Loan Connect** exists but Meta applied a **Business restriction** (account integrity / automation policy).
- Effects: cannot create/run ads; Events/Pixel collection restricted under that portfolio; CAPI **Generate access token** blocked.
- Existing Dataset/Pixel **1057590634424945** still loads in browser after consent on Production.
- CAPI Graph calls still return OAuthException **190** (invalid/unparsable access token in Vercel).
- Owner must use Meta **Request review** on the restriction, then generate a valid CAPI token and replace `META_CAPI_ACCESS_TOKEN` in Vercel Production, then Redeploy.
