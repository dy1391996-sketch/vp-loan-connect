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
| #19–#20 | docs | Instagram/Pixel activation notes + Meta Business restriction |

Production main includes through **#20** docs lineage; Pixel/consent/public-config live on Production.

## Cloud Agent environment

- Environment ID: `87b676b9-91a6-11f1-ba66-0e7d0216e441`
- Validated draft build: `bld-20260816-a9e47bdc-4dc6-47ff-8ef2-6dfcc451d807` (SUCCEEDED)
- Install: `pnpm@11.9.0` + `pnpm install --frozen-lockfile` + placeholder `DATABASE_URL` for `pnpm db:generate`
- Local verification: typecheck PASS; tests **136/136**
- **Save:** proposed for owner Save in Environment panel (agent browser session did not have the Save tab available)

## Vercel project (proven)

- **Team:** `dpk09` (dpk)
- **Project:** `vp-loan-connect`
- **DOMAIN_MATCH:** yes — `https://www.vploanconnect.in` / `https://vploanconnect.in`
- Latest Production deployment observed Ready (~3h before last autonomous pass)
- `META_CAPI_ACCESS_TOKEN` present on Production (Updated ~3h); value never logged

## Production environment variable NAMES (no values)

| Name | Production |
| --- | --- |
| `NEXT_PUBLIC_INSTAGRAM_URL` | PRESENT (`@vploanconnect.in`) |
| `NEXT_PUBLIC_META_PIXEL_ID` | PRESENT (`1057590634424945`) |
| `META_CAPI_PIXEL_ID` | PRESENT |
| `META_CAPI_ACCESS_TOKEN` | PRESENT (non-empty; **Graph rejects with OAuthException 190**) |
| `META_TEST_EVENT_CODE` | ABSENT (optional) |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | ABSENT (optional) |

## Production verification (runtime)

| Check | Status |
| --- | --- |
| `/` `/contact` `/apply/quick` | 200 |
| Public phone / WhatsApp / `tel:` / `wa.me` hrefs | Absent |
| Instagram CTA | `https://www.instagram.com/vploanconnect.in/` |
| `/api/public-config` | Pixel `1057590634424945`, IG correct, `metaCapiConfigured:true`, **no token leak** |
| Consent-gated Pixel (prior verified) | Pre-consent blocked; post-consent Pixel `1057590634424945` + LandingPageView |
| Shared `event_id` Pixel→CAPI client path | Implemented (code + prior browser verify) |
| CAPI Graph delivery | **FAIL** — `accepted:true,sent:false,reason:provider_auth_rejected` |
| Vercel function logs | `meta_capi_rejected 400 OAuthException 190` |
| Ads spend | ₹0 |

## CAPI root-cause (verified 2026-08-16)

**Implementation (not the primary failure):**

- Endpoint: `POST https://graph.facebook.com/{META_GRAPH_API_VERSION\|v22.0}/{pixelId}/events?access_token=…`
- Pixel/Dataset ID: `META_CAPI_PIXEL_ID` \|\| `NEXT_PUBLIC_META_PIXEL_ID` → Production `1057590634424945`
- Body: standard CAPI `data[]` with `event_name`, `event_time`, `event_id`, `action_source=website`, `user_data`, optional `test_event_code`
- Wrapper maps Meta **code 190** / `OAuthException` → `provider_auth_rejected`

**Meta platform (primary failure):**

| Field | Value |
| --- | --- |
| HTTP | 400 |
| `error.type` | `OAuthException` |
| `error.code` | **190** |
| `error_subcode` | not present in logs (empty) |
| Classification | **invalid / unparsable / unauthorized access token** for this Dataset |

**Ownership / permission evidence (browser, existing Meta session):**

- Dataset **1057590634424945** (“VP Loan Connect Website”) visible in Events Manager under personal ad-account context `2242693046482307`
- **Generate access token** blocked: *“You must be an admin or developer for this business portfolio to create an access token.”*
- Portfolio **VP Loan Connect** (`1065984692638768`): user has Full access, but portfolio is **restricted from Events Manager / pixel collection**; dataset **not** listed under that portfolio’s Datasets
- Portfolio **The Studio 99 Stay**: unrestricted, but dataset **not** claimable there via UI
- Do **not** create a second Dataset/Pixel; Production already references `1057590634424945`
- Do **not** rotate Vercel token again until Meta allows a valid token for this exact Dataset

## Meta / Instagram assets

| Asset | Status |
| --- | --- |
| Dataset/Pixel `1057590634424945` | Exists; browser Pixel path works after consent |
| Business Portfolio VP Loan Connect | Exists; **Events Manager restricted** |
| Instagram `@vploanconnect.in` | Live on website CTA; owner privacy polish deferred |
| Ad campaigns / spend | None (₹0) |

## Remaining hard blockers (human / Meta only)

1. Clear **VP Loan Connect** Business Portfolio Events Manager restriction (Request review / Meta support), **or** transfer/claim Dataset `1057590634424945` into an unrestricted portfolio where the operator is admin/developer.
2. Then **Generate** a valid CAPI token for Dataset `1057590634424945` only → replace Production `META_CAPI_ACCESS_TOKEN` (no quotes/spaces/newlines) → Redeploy → expect `sent:true`.
3. Optional: GitHub App **Issues Read/Write** so Issue #13 can be commented via API.
4. Optional: click **Save** on Cloud Agent environment proposal if not already saved.

## MEASUREMENT_READY

**no** — blocked on Meta OAuthException **190** / token generation permission + portfolio Events restriction. Site Pixel/consent/public-config paths remain healthy.
