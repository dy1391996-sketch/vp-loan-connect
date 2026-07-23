# VP Loan Connect Release 0.1.0

Release date: 23 July 2026

VP Loan Connect is a mobile-first financial education, loan-profile assessment, paid report, referral and consent-management platform operated by THE99CREW FACILITY MANAGEMENT. It is not a bank, NBFC, lender or credit bureau and does not promise approval, rates, disbursement or credit-score improvement.

## Features

- Hindi-English marketing site with loan-category education, rejection-awareness content, FAQs, disclaimers and a reducing-balance EMI calculator.
- Four-step free assessment covering identity, OTP verification, income, current obligations, credit-health indicators and document readiness.
- Separate mandatory service and optional marketing consent, including versioned wording, source, acceptance time and withdrawal records.
- Transparent 0–100 internal readiness score with factor breakdown, EMI burden, document status, credit-health status, general categories and indicative EMI comfort range.
- Razorpay server-side order creation, payment-signature validation, webhook-signature validation, idempotent webhook processing, refunds and payment retry paths.
- Credit Health Action Plan and Complete Loan Readiness Report products with GST-aware pricing.
- Secure bilingual PDF generation with signed report access, report references and regeneration controls.
- Official WhatsApp Business Platform adapter, service/marketing purpose enforcement and idempotent STOP handling.
- Referral links, click attribution, self-referral prevention, unique order rewards, validation periods and configurable milestone settings.
- Role-based admin CRM for leads, consent history, assessments, payments, reports, referrals, notes, exports, refunds and audit logs.
- Privacy, terms, refund, disclaimer, consent, deletion, contact and grievance pages.
- Privacy-conscious first-party analytics events, metadata, sitemap, robots, web manifest and security headers.

## Architecture

| Layer | Implementation |
|---|---|
| Web application | Next.js 15 App Router, React 19, TypeScript |
| Styling | Tailwind CSS 4, reusable UI components, Noto Sans Devanagari |
| Server APIs | Next.js route handlers with Zod validation |
| Data | PostgreSQL through Prisma ORM |
| Authentication | Hashed OTP records; signed short-lived user links; secure, database-backed admin sessions |
| Payments | Razorpay REST orders, browser checkout, server HMAC verification and signed webhooks |
| Messaging | Provider abstraction for Meta WhatsApp Business Platform and a local-only mock |
| Reports | `@react-pdf/renderer` with embedded Hindi and Latin font subsets |
| Deployment | GitHub Actions verification and Vercel-compatible build |

Browser code never receives Razorpay secrets, database credentials, OTP provider keys, WhatsApp access tokens or signing secrets. All sensitive decisions, scores, payment verification, report authorization and role checks run server-side.

## Database

The canonical schema is [prisma/schema.prisma](prisma/schema.prisma). The initial PostgreSQL migration is [prisma/migrations/20260723000000_initial/migration.sql](prisma/migrations/20260723000000_initial/migration.sql).

Core data groups:

- Leads, OTP requests, assessments, answers, scores and consent logs.
- Products, orders, payments, webhook events, refunds and reports.
- Referral clicks, referrals, rewards and application settings.
- Consultations, lender-referral requests, lenders and lender products.
- Admin users, sessions and audit logs.
- Communications, analytics events and data-deletion requests.

UUID primary keys, unique provider references, unique reward order IDs, useful status/date indexes and soft-deletion fields are included. `npm run verify:migration` regenerates SQL from the schema and fails if it differs from the committed migration.

## Environment variables

Use `.env.example` as the inventory. Required production groups are:

- Core: `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_SECRET`, `REPORT_SIGNING_SECRET`.
- Razorpay: `PAYMENT_PROVIDER=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
- OTP: `OTP_PROVIDER=custom`, `OTP_API_URL`, `OTP_API_KEY`.
- WhatsApp: `WHATSAPP_PROVIDER=meta`, `WHATSAPP_API_URL`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`.
- Business: `BUSINESS_NAME`, `BUSINESS_GSTIN`, `BUSINESS_ADDRESS`, `SUPPORT_EMAIL`, `SUPPORT_WHATSAPP`, `GRIEVANCE_NAME`, `GRIEVANCE_EMAIL`.
- Initial administration: `ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD`.
- Optional controls: `STORE_CONSENT_IP`, `ANALYTICS_ID`.

Production builds validate official provider modes, HTTPS, secret lengths, GSTIN format, international WhatsApp format and all launch-critical business fields.

## Deployment steps

1. Add the approved GitHub remote and push `main`.
2. Create/import the repository in Vercel.
3. Provision PostgreSQL with SSL, automated backups and point-in-time recovery.
4. Add all production environment variables to Vercel.
5. Run `pnpm install --frozen-lockfile`.
6. Run `pnpm db:generate`.
7. Run `pnpm db:deploy` once from a protected release job.
8. Run `pnpm build`.
9. Run `pnpm db:seed` once to create products, settings and the initial administrator.
10. Rotate or remove `ADMIN_INITIAL_PASSWORD` after the first successful login.
11. Configure `vploanconnect.in`, HTTPS and DNS.
12. Configure Razorpay and Meta webhook URLs, secrets and approved WhatsApp templates.
13. Complete sandbox payment, OTP, WhatsApp, PDF, referral, CSV and role tests before accepting customers.

## Owner actions

- Select the GitHub repository URL and visibility.
- Supply the production PostgreSQL connection and backup policy.
- Supply Razorpay live/test credentials and configure webhook events.
- Select the official OTP vendor and confirm its request/response contract.
- Supply Meta WhatsApp Business credentials and approve message templates.
- Confirm GSTIN, registered business address, support WhatsApp, grievance contact and final legal review.
- Set referral milestone bonus values.
- Approve the production domain and DNS changes.
- Execute final real-provider and physical-device acceptance testing.
