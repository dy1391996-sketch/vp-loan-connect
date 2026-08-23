# VPLC Automation Status

## Issue / scope

- **Issue:** https://github.com/dy1391996-sketch/vp-loan-connect/issues/13
- **GitHub Issues API:** 403 for automation App (`issues=read` missing) — cannot comment via API until Issues Read/Write is granted.

## Canonical identity (production + Meta target)

| Field | Value |
| --- | --- |
| Brand | VP Loan Connect |
| Website | https://www.vploanconnect.in |
| Instagram | https://www.instagram.com/vploanconnect.in/ |
| Business Portfolio | **VP Loan Connect** `1065984692638768` |
| Canonical business email | `info@vploanconnect.in` (visible in Meta business/ad-account contact config) |
| Public phone / WhatsApp / Call CTA | **Must stay hidden** on website (Quick Apply + Instagram Direct + support email only) |
| Ads spend | **₹0** |

## Merged delivery (code/docs on `main`)

| PR | Commit | Purpose |
| --- | --- | --- |
| #15 | `b56cfeb…` | Public contact cleanup + consent-gated Meta Pixel/CAPI |
| #16 | `4eac54e…` | Fontsource CI reliability |
| #17 | `472e666…` | Runtime `/api/public-config` + Instagram/Pixel hydration |
| #18 | `5bf0a7e…` | CAPI provider rejection classification (OAuth vs param) |
| #19–#20 | docs | Instagram/Pixel activation notes + Meta Business restriction |
| #22 | `3de1182…` | Sanitized CAPI OAuth diagnostics |
| #24 | Instagram organic kit | Profile/content setup |
| #25 | `6191fc7…` | Earlier Credit Profile Booster in Quick Apply + homepage refresh |

Pixel/consent/public-config remain live on Production. Funnel/UI from **#25** is on Production `main`.

## Cloud Agent environment

- Environment ID: `87b676b9-91a6-11f1-ba66-0e7d0216e441`
- Validated draft build: `bld-20260816-a9e47bdc-4dc6-47ff-8ef2-6dfcc451d807` (SUCCEEDED)
- Install: `pnpm@11.9.0` + `pnpm install --frozen-lockfile` + placeholder `DATABASE_URL` for `pnpm db:generate`
- Local verification at that build: typecheck PASS; tests **136/136**
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
| `NEXT_PUBLIC_META_PIXEL_ID` | PRESENT (`1057590634424945`) — still the legacy Dataset; fresh-Dataset migration blocked |
| `META_CAPI_PIXEL_ID` | PRESENT |
| `META_CAPI_ACCESS_TOKEN` | PRESENT (non-empty; **Graph rejects with OAuthException 190**) |
| `META_TEST_EVENT_CODE` | ABSENT (optional) |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | ABSENT (optional) |
| Cashfree / OTP / pricing secrets | Untouched |

## Production verification (runtime)

| Check | Status |
| --- | --- |
| `/` `/contact` `/apply/quick` | 200 |
| Public phone / WhatsApp / `tel:` / `wa.me` hrefs | Absent |
| Instagram CTA | `https://www.instagram.com/vploanconnect.in/` |
| `/api/public-config` | Pixel `1057590634424945`, IG correct, `metaCapiConfigured:true`, **no token leak** |
| Consent-gated Pixel | Pre-consent blocked; post-consent still loads **legacy** Dataset `1057590634424945` + LandingPageView |
| Shared `event_id` Pixel→CAPI client path | Implemented (code + prior browser verify) |
| CAPI Graph delivery | **FAIL** — `accepted:true,sent:false,reason:provider_auth_rejected` (OAuthException **190**) |
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
- Do **not** rotate Vercel token again until Meta allows a valid token for this exact Dataset
- Do **not** create a second **portfolio** to bypass the restriction

## Fresh Dataset migration attempt (2026-08-16)

A later bounded attempt to create a **new** Dataset under the VP Loan Connect portfolio (instead of repairing old-Dataset ownership) was blocked by Meta.

### Phase 1 — Old Dataset bounded check

| Item | Result |
| --- | --- |
| Old Dataset ID | `1057590634424945` (“VP Loan Connect Website”) |
| Ownership context | Personal advertising / ad-account context (not cleanly under VP Loan Connect portfolio Datasets list) |
| Self-service assign / share / move to VP Loan Connect | **Not available** in UI (bounded check) |
| **OLD_DATASET_STATUS** | **LEGACY_DO_NOT_USE for ownership repair** (do not delete in Meta; Production still references this ID until a legitimate replacement exists) |

### Phase 2–3 — New Dataset under VP Loan Connect

| Item | Result |
| --- | --- |
| Portfolio | VP Loan Connect `1065984692638768` |
| Restriction banner | *You can't use this business portfolio to advertise / create ads.* |
| Account Quality | Restricted **11 Aug 2026**; reason: automation / account-integrity Advertising Standards |
| Account Quality review | **Review complete** — Meta did **not** remove restrictions; **no** further “Request review” button on the page |
| Create Dataset attempt | Name `VP Loan Connect Website`, Web, site `https://www.vploanconnect.in` |
| Meta create error | *Business is not allowed to create Pixel. Your business is prohibited from advertising, including pixel creation.* |
| **NEW_DATASET_CREATED** | **No** |
| Second portfolio to bypass restriction | **Not created** (would evade Meta enforcement) |
| Instagram under portfolio | Not connected in Business Settings (website CTA still uses `@vploanconnect.in` via Vercel) |

### Phases 4–12 — Blocked (no new Dataset)

Cannot generate a new CAPI token, migrate Vercel Pixel/CAPI IDs, or verify `sent:true` / Test Events / Meta-side dedup until Meta lifts the VP Loan Connect advertising / pixel-creation prohibition.

### Meta Support appeal (2026-08-16)

| Item | Result |
| --- | --- |
| Channel | Meta Business Support Home → Meta AI Business Assistant (`business.facebook.com/business-support-home`) |
| Appeal text | Submitted (portfolio `1065984692638768`, website, `info@vploanconnect.in`, `@vploanconnect.in`, Events Manager / CAPI need; no circumvention) |
| Formal case ID | None (AI chat, not a numbered ticket) |
| Chat | Saved as “Manual Appeal For Business…” (Today) |
| Live agent transfer | Unavailable — specialized team at full capacity per AI |
| AI stated root theme | Fake-accounts / account-integrity scrutiny; incomplete Business Verification; missing linked Page signal |
| Recommended Meta path | **Start Business Verification** (legal docs) + link official Facebook Page |
| Legal document upload | **Not performed by agent** — owner must complete Business Verification |

## Meta / Instagram assets

| Asset | Status |
| --- | --- |
| Dataset/Pixel `1057590634424945` | Exists; browser Pixel path works after consent; CAPI token generation blocked |
| Business Portfolio VP Loan Connect | Exists; **Events Manager / advertising / pixel-creation restricted** |
| Instagram `@vploanconnect.in` | Live on website CTA; owner privacy polish deferred |
| Ad campaigns / spend | None (₹0) |

## Remaining hard blockers (human / Meta only)

1. Complete **Business Verification** (legal docs) for portfolio `1065984692638768` and wait for Meta to lift the advertising / Events Manager / pixel-creation restriction. Agent already submitted the Support appeal; live-agent transfer was unavailable.
2. After restriction clears, restore a valid CAPI token **without creating a second portfolio**:
   - Prefer generating a token for existing Dataset `1057590634424945` if Meta then allows admin/developer token generation for that Dataset.
   - If Meta still will not attach/claim `1057590634424945` into VP Loan Connect, create Dataset **VP Loan Connect Website** (Web) under that portfolio, record the new ID, and point Production `NEXT_PUBLIC_META_PIXEL_ID` / `META_CAPI_PIXEL_ID` / `META_CAPI_ACCESS_TOKEN` at the **new** Dataset only. Leave the old Dataset in Meta as legacy; do not delete unless separately decided.
3. Redeploy and verify `/api/public-config` Pixel ID, consent Pixel, `sent:true`, Test Events, and matching `event_id` dedupe.
4. Optional: GitHub App **Issues Read/Write** so Issue #13 can be commented via API.
5. Optional: click **Save** on Cloud Agent environment proposal if not already saved.

## MEASUREMENT_READY

**no**

Hard blocker is **Meta portfolio advertising / pixel-creation restriction** on VP Loan Connect `1065984692638768` (OAuthException **190** on the current token; new Dataset create also rejected). Site Pixel/consent/public-config paths remain healthy. This is not missing Vercel wiring or website code.

Do **not** paste token values into chat or docs.
