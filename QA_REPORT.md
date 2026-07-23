# QA Report

Project: VP Loan Connect  
Release: 0.1.0  
Test date: 23 July 2026  
Environment: local production build, Node.js 24, Next.js 15.5.21

## Result

The locally verifiable release gates pass. Provider-dependent end-to-end checks are intentionally deferred until real PostgreSQL, Razorpay, OTP and Meta WhatsApp test credentials are installed.

## Automated coverage

The Node test suite verifies:

- Mandatory service consent and optional/withdrawn marketing consent.
- Transparent readiness scoring and adverse-profile penalties.
- Reducing-balance EMI calculations, zero-interest handling and invalid inputs.
- Referral self-attribution and duplicate/reversed reward eligibility.
- Razorpay checkout and webhook HMAC verification.
- Meta WhatsApp webhook HMAC verification.
- Paid report access authorization and expiry.
- Role-based admin export/settings permissions.
- Bilingual Hindi-English PDF rendering.
- Strict production environment validation.

## Local command results

| Gate | Result |
|---|---|
| Dependency install | Pass |
| Dependency vulnerability audit | Pass — 0 vulnerabilities |
| Prisma client generation | Pass |
| Prisma schema validation | Pass |
| Migration/schema drift verification | Pass |
| ESLint with zero warnings | Pass |
| TypeScript no-emit check | Pass |
| Automated tests | Pass |
| Strict production build | Pass |
| Required-file/readiness verifier | Pass |

Automated result: 21 tests passed across 7 suites with zero failures, skips or cancellations.

## Route smoke coverage

The built application returns expected success or authentication-redirect responses for:

- Homepage, assessment, paid product, referral and legal routes.
- Invalid/missing secure result, checkout, payment and report-link states.
- Admin login and protected admin pages.
- Robots, sitemap, manifest and favicon.
- Invalid API payload rejection.
- Unauthenticated admin API rejection.
- Invalid Razorpay and WhatsApp webhook signature rejection.

## Responsive and accessibility review

- Mobile-first layouts use 320px-compatible wrapping, large touch targets and responsive grids.
- Form inputs have visible labels, required indicators, input modes and browser autocomplete hints.
- Navigation exposes accessible labels and expansion state.
- Focusable controls use native buttons, links, inputs and checkboxes.
- Hindi font assets are locally bundled; PDF Hindi and English extraction is automated.
- Tables are placed in horizontal scroll containers at narrow widths.
- Result and report pages are excluded from indexing.

## Production acceptance still required

- Real OTP delivery, expiry, resend and abuse checks.
- Razorpay sandbox checkout, capture, failure, retry, duplicate webhook and refund.
- WhatsApp template delivery, inbound STOP and post-opt-out suppression.
- PostgreSQL migration deployment, seed, backup and restore.
- Chrome, macOS Safari, iPhone Safari and Android Chrome checks on physical devices.
- Lighthouse/accessibility/SEO scans against the final production URL.
- Production CSV export, PDF download, admin roles and referral payout workflow.
