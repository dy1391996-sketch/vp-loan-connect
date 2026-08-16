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

## Fresh Dataset migration attempt (2026-08-16)

### Phase 1 — Old Dataset bounded check

| Item | Result |
| --- | --- |
| Old Dataset ID | `1057590634424945` (“VP Loan Connect Website”) |
| Ownership context | Personal advertising / ad-account context (not cleanly under VP Loan Connect portfolio Datasets list) |
| Self-service assign / share / move to VP Loan Connect | **Not available** in UI (bounded check) |
| **OLD_DATASET_STATUS** | **LEGACY_DO_NOT_USE** (do not delete in Meta; stop trying to repair ownership) |

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

## What still works on Production (unchanged)

| Check | Status |
| --- | --- |
| `/` `/contact` `/apply/quick` | 200 |
| `/api/public-config` | Instagram `@vploanconnect.in`, Pixel still `1057590634424945`, `metaCapiConfigured:true`, **no token leak** |
| Public `tel:` / `wa.me` | Absent |
| Consent-gated browser Pixel | Still loads **legacy** Dataset `1057590634424945` after consent (legacy ID remains Production env until a legitimate new Dataset exists) |
| CAPI | Still `accepted:true,sent:false,reason:provider_auth_rejected` (OAuthException **190**) |
| Cloud Agent env | Validated draft build `bld-20260816-a9e47bdc-4dc6-47ff-8ef2-6dfcc451d807` — Save in Environment panel if not already |

## Vercel Production env NAMES (no values)

| Name | Status |
| --- | --- |
| `NEXT_PUBLIC_INSTAGRAM_URL` | PRESENT → `@vploanconnect.in` |
| `NEXT_PUBLIC_META_PIXEL_ID` | PRESENT → still legacy `1057590634424945` (migration blocked) |
| `META_CAPI_PIXEL_ID` | PRESENT |
| `META_CAPI_ACCESS_TOKEN` | PRESENT but Graph-rejected (190) |
| Cashfree / OTP / pricing secrets | Untouched |

## MEASUREMENT_READY

**no**

Hard blocker is **Meta portfolio advertising / pixel-creation restriction** on VP Loan Connect `1065984692638768`, not missing Vercel wiring or website code.

## Owner actions after Meta clears restriction

1. Confirm Account Quality / advertising restriction cleared for portfolio `1065984692638768`.
2. Create Dataset **VP Loan Connect Website** (Web) under that portfolio; record new ID.
3. Generate CAPI token for the **new** Dataset only → set Production `NEXT_PUBLIC_META_PIXEL_ID`, `META_CAPI_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN` → Redeploy.
4. Verify `/api/public-config` shows **new** ID (not `1057590634424945`), consent Pixel, `sent:true`, Test Events, matching `event_id` dedupe.
5. Leave old Dataset in Meta as legacy; do not delete unless separately decided.
6. Optional: GitHub App Issues Read/Write for Issue #13; Save Cloud Agent environment; Instagram privacy polish.

Do **not** paste token values into chat or docs.
