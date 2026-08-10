# VPLC Automation Status

## Trigger and GitHub issue

- **Trigger:** Direct execution request — `START VPLC TECH EXECUTION` for Issue #13
- **Issue:** https://github.com/dy1391996-sketch/vp-loan-connect/issues/13
- **Note:** GitHub Issues API still returns 403 (`issues=read` missing) for this agent token; work scope taken from the explicit execution priorities in the run prompt.

## Starting commit

- `77611b998fff794afee06c2a6d702543a1d03ddd` (`origin/main`)

## Branch

- `cursor/issue-13-meta-public-contact`

## Verified current state (before this PR)

- No public `tel:` CTAs in `src/`
- Public WhatsApp CTA in referral share (`wa.me/?text=`) + legacy `script.js` business number
- No Instagram public contact route
- UTM attribution present; Meta Pixel/CAPI absent
- Hardcoded GA loaded without consent banner

## Work completed

1. Removed public WhatsApp share CTA; replaced with Copy + native Share (no `wa.me`).
2. Removed legacy `script.js` WhatsApp number; `sendWA` routes to `/apply/quick`.
3. Stopped embedding `SUPPORT_WHATSAPP` in customer PDFs.
4. Added public Instagram Direct contact (env-gated via `NEXT_PUBLIC_INSTAGRAM_URL`) on Contact + Footer.
5. Softened public “WhatsApp consultation/support” marketing copy; kept server WhatsApp Business templates.
6. Added marketing consent banner; GA + Meta Pixel load only after consent.
7. Implemented Meta Pixel readiness + Conversions API route with shared `event_id` dedupe.
8. Extended first-party analytics allowlist; mapped funnel events to Meta catalog.
9. Updated CSP for Meta/GA hosts (still no allow-all).
10. Added regression tests for public-contact policy, consent parse, Meta events/CAPI payload.
11. Full local verify: install, prisma validate, migrate deploy, migration verify, readiness, audit, lint, typecheck, tests (133), production build.

## Files changed (high level)

- Public contact: `referral-dashboard-client.tsx`, `script.js`, `contact/page.tsx`, `footer.tsx`, `public-contact.ts`, report PDF data, copy pages
- Meta/consent: `src/lib/meta/*`, `src/lib/consent/*`, `analytics-provider.tsx`, `analytics-client.ts`, `api/meta/conversions`, `api/analytics`, `csp.ts`, `env.ts`, `.env.example`
- Tests + `docs/VPLC_AUTOMATION_STATUS.md`

## Test results

- `pnpm install --frozen-lockfile` — pass
- `prisma validate` / `db:deploy` / `verify:migration` / `verify:readiness` — pass
- `pnpm audit --prod --audit-level moderate` — no known vulnerabilities
- `pnpm lint` — pass
- `pnpm typecheck` — pass
- `pnpm test` — **133 pass / 0 fail**
- `pnpm build` — pass (includes `/api/meta/conversions`)

## PR and CI links

- PR: https://github.com/dy1391996-sketch/vp-loan-connect/pull/15
- Issue comment on #13: **blocked** (GitHub Issues write 403 for this token)
- CI: **success** — https://github.com/dy1391996-sketch/vp-loan-connect/actions/runs/31428446691

## Missing variable names (no values)

Set in **Vercel → Project → Settings → Environment Variables** (Production), then redeploy:

- `NEXT_PUBLIC_INSTAGRAM_URL`
- `NEXT_PUBLIC_META_PIXEL_ID`
- `META_CAPI_ACCESS_TOKEN`
- `META_CAPI_PIXEL_ID` (optional; defaults to pixel id)
- `META_TEST_EVENT_CODE` (optional sandbox)
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` (optional; GA only loads after consent)

Also grant Cursor GitHub App **Issues: Read and write** so future runs can read/comment on #13.

## Remaining work

1. Deepak: set Instagram + Meta env vars in Vercel (names above).
2. Deepak: approve/merge PR (no auto-merge/deploy by agent).
3. After secrets: verify Meta Test Events in Events Manager; confirm Instagram CTA appears on `/contact`.

## Exact next action

```text
Deepak: 1) Review/merge PR for issue #13. 2) In Vercel Production env, set NEXT_PUBLIC_INSTAGRAM_URL, NEXT_PUBLIC_META_PIXEL_ID, META_CAPI_ACCESS_TOKEN (and optional META_CAPI_PIXEL_ID / META_TEST_EVENT_CODE / NEXT_PUBLIC_GA_MEASUREMENT_ID). 3) Redeploy. 4) Grant GitHub Issues read/write to Cursor for issue comments.
```

## OVERALL_STATUS

**READY FOR REVIEW** — public WA/phone CTAs removed; Instagram + Meta readiness implemented behind env + consent; protected payment/OTP flows untouched.
