# VP Loan Connect

Mobile-first, consent-aware financial education, preliminary loan-profile assessment and paid report platform for **THE99CREW FACILITY MANAGEMENT**.

VP Loan Connect is not a bank, NBFC, lender or credit bureau. It does not sanction loans or guarantee approval, rates, score improvement or disbursement.

## Current stack

- Next.js 15.5.21 App Router (Turbopack production build) and React 19.1.9
- TypeScript 5.9 and Tailwind CSS 4
- PostgreSQL with Prisma ORM 6.19
- Secure cookie admin sessions with `jose` and `bcryptjs`
- Razorpay server order/signature/webhook integration with development mock mode
- Official WhatsApp Business Platform provider abstraction with development mock mode
- OTP provider abstraction with development mock mode
- `@react-pdf/renderer` with embedded Noto Sans Devanagari/Latin subsets
- Node test runner via `tsx`

## Implemented routes

Public and customer routes:

- `/`, `/check`, `/personal-loan`, `/assessment`, `/result/[id]`
- `/credit-health`, `/loan-readiness`, `/checkout`
- `/payment/success`, `/payment/failed`, `/report/[id]`
- `/refer`, `/r/[code]`, `/referral-dashboard`, `/consultation`
- `/privacy`, `/terms`, `/refund-policy`, `/disclaimer`, `/consent-policy`, `/data-deletion`, `/contact`

Admin routes:

- `/admin/login`, `/admin`, `/admin/leads`, `/admin/leads/[id]`
- `/admin/payments`, `/admin/reports`, `/admin/referrals`, `/admin/settings`

## Local setup

Requirements: Node.js 20+ (Node 22 LTS recommended), pnpm 11+, and PostgreSQL 15+.

```bash
cp .env.example .env.local
pnpm install
pnpm db:generate
pnpm db:deploy
pnpm db:seed
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

The initial admin is created only when `ADMIN_EMAIL` is valid and `ADMIN_INITIAL_PASSWORD` is at least 12 characters. Remove or rotate the bootstrap password after seeding.

## Database migration and seed

The committed initial migration is in `prisma/migrations/20260723000000_initial/migration.sql`.

For a new local database:

```bash
pnpm db:deploy
pnpm db:seed
```

For a new schema change during development:

```bash
pnpm db:migrate --name describe_the_change
pnpm db:generate
```

Production uses `pnpm db:deploy`; never use `migrate dev` against production.

The seed creates products, assessment question metadata, score bands, referral settings, WhatsApp templates, legal-review status and—only with safe credentials—one administrator. It creates no fake customers, lenders, approvals, ratings, partnerships or testimonials.

## Environment variables

Copy `.env.example` and configure:

| Variable | Required | Purpose |
|---|---:|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string with SSL where the provider requires it |
| `NEXT_PUBLIC_APP_URL` | Yes | Canonical origin, e.g. `https://vploanconnect.in` |
| `NEXTAUTH_SECRET` | Yes | 32+ random chars for OTP/result/admin tokens |
| `REPORT_SIGNING_SECRET` | Yes | Separate 32+ random chars for report links |
| `PAYMENT_PROVIDER` | Yes | `mock` locally; `razorpay` in production |
| `RAZORPAY_KEY_ID` | Production | Public checkout key identifier |
| `RAZORPAY_KEY_SECRET` | Production | Server-only API/signature secret |
| `RAZORPAY_WEBHOOK_SECRET` | Production | Server-only webhook HMAC secret |
| `OTP_PROVIDER` | Yes | `mock` locally; `custom` in production |
| `OTP_API_URL`, `OTP_API_KEY` | Production | MSG91 SendOTP v5 endpoint with `template_id`; MSG91 auth key |
| `MOCK_OTP_CODE` | Local only | Six-digit mock code; rejected in production |
| `WHATSAPP_PROVIDER` | Yes | `mock` locally; `meta` for official Business Platform |
| `WHATSAPP_API_URL` | Meta | Graph API base URL |
| `WHATSAPP_ACCESS_TOKEN` | Meta | Server-only access token |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta | Official business phone number id |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Meta | Inbound webhook verification token |
| `WHATSAPP_APP_SECRET` | Meta | Inbound webhook signature secret |
| `STORE_CONSENT_IP` | No | Defaults false; enable only after documented legal/privacy review |
| `ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD` | Initial seed | Bootstrap admin; password must be 12+ chars |
| `BUSINESS_NAME` | Yes | Legal entity name on invoice/report |
| `BUSINESS_GSTIN`, `BUSINESS_ADDRESS` | Before launch | Invoice and legal identity |
| `SUPPORT_EMAIL`, `SUPPORT_WHATSAPP` | Before launch | Support and grievance channels |
| `GRIEVANCE_NAME`, `GRIEVANCE_EMAIL` | Before launch | Named grievance contact displayed to users |
| `ANALYTICS_ID` | Optional | Reserved for approved privacy-conscious analytics integration |

Generate strong secrets with your approved secret manager or `openssl rand -base64 48`. Never commit `.env*` values.

## Provider modes

### OTP

`OTP_PROVIDER=mock` returns the development code to the browser and is explicitly rejected when `NODE_ENV=production`.

For MSG91, set `OTP_PROVIDER=custom`, `OTP_API_KEY` to the MSG91 auth key, and `OTP_API_URL` to the SendOTP v5 endpoint with the approved template id, for example:

```text
https://control.msg91.com/api/v5/otp?template_id=YOUR_MSG91_TEMPLATE_ID&otp_length=6&otp_expiry=10
```

The adapter sends the app-generated six-digit OTP to MSG91 with the mobile number in `91XXXXXXXXXX` format and the auth key in the `authkey` header. Keep the MSG91 template text aligned with the approved DLT template and the `##OTP##` placeholder.

### Razorpay

The browser never receives the secret. Orders are created on the server; checkout success is verified with HMAC; raw webhook payloads are verified before parsing. Configure the Razorpay webhook URL:

```text
https://vploanconnect.in/api/webhooks/razorpay
```

Subscribe at minimum to `payment.captured` and `payment.failed`. The unique provider event and payment identifiers make retries safe.

### WhatsApp Business Platform

Configure inbound webhook:

```text
https://vploanconnect.in/api/webhooks/whatsapp
```

Create and approve service templates matching the seeded keys: `assessment_started`, `incomplete_assessment`, `free_result_ready`, `payment_success`, `report_ready`, and `opt_out_confirmation`. Promotional sending is blocked unless active marketing consent exists. Inbound `STOP` records withdrawal and sends one confirmation.

No WhatsApp Web automation or unofficial bulk messaging is used.

## Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The same local gates are available through npm:

```bash
npm install
npx prisma generate
npm run verify:migration
npm run verify:readiness
npm run lint
npm run type-check
npm test
npm run build
```

Automated tests cover assessment consent, scoring, EMI calculation, marketing withdrawal, referral self/duplicate controls, payment/webhook signatures, paid report access, admin export authorization and bilingual PDF output. Browser/device QA should additionally cover 320px, 375px, 768px and 1440px widths, keyboard navigation, Android/iOS download behavior and real Razorpay/WhatsApp test accounts.

## GitHub and CI

Initialize the repository once, connect it to the owner-approved GitHub repository, and publish `main`:

```bash
git init
git add .
git commit -m "feat: build VP Loan Connect platform"
git branch -M main
git push -u origin main
```

The included GitHub Actions workflow runs Prisma generation, schema validation, lint, type-check, tests and a production build with an ephemeral PostgreSQL service.

## Vercel deployment

1. Import the GitHub repository into Vercel.
2. Set Framework Preset to Next.js and package manager to pnpm.
3. Add all production environment variables; never use mock providers in production.
4. Provision managed PostgreSQL with backups and SSL, then set `DATABASE_URL`.
5. Set the Build Command to `pnpm db:generate && pnpm build`.
6. Run `pnpm db:deploy` once from a protected deployment job before switching traffic.
7. Seed production once with temporary bootstrap admin credentials, then rotate/remove `ADMIN_INITIAL_PASSWORD`.
8. Configure `vploanconnect.in`, HTTPS, Razorpay webhook and Meta webhook.
9. Perform real provider sandbox/test payments before enabling live mode.

Do not run database migrations concurrently from multiple Vercel builds. Use one protected migration job or release workflow.

## Security and operations

- Use a managed PostgreSQL service with point-in-time recovery, daily backups, encrypted storage and quarterly restore drills.
- Restrict database network access and use separate least-privilege runtime/migration credentials.
- Rotate provider, admin bootstrap and signing secrets periodically and after any suspected exposure.
- Place distributed rate limiting (for example, managed Redis) in front of OTP/login/payment endpoints for multi-instance production; the included limiter is process-local.
- Configure log redaction and retention. Never log OTPs, secrets, full payment payloads or sensitive documents.
- Review audit logs, failed payments, opt-outs, deletion requests and report failures operationally.
- Finalize the legal business address, GSTIN, named grievance officer and policy/legal review before launch.

## Owner decisions still required

- Production PostgreSQL provider and backup policy
- Official OTP vendor/API contract
- Razorpay live credentials and webhook secret
- Meta WhatsApp Business account, approved templates and tokens
- GSTIN, business address, support WhatsApp and named grievance contact
- Legal review of all policies, consent text, refund process and lender-referral workflow
- Referral milestone bonus amounts (seeded as zero until approved)
- Any future lender must pass verified, contract-active, logo-permitted and product-approved flags before publication
