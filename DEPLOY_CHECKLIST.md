# Deployment and Production Readiness Checklist

Status date: 23 July 2026

## Locally verified

- [x] Git repository initialized on `main`.
- [x] Work divided into meaningful phase commits.
- [x] Working tree contains no committed secrets.
- [x] `.env.example` lists every required configuration key.
- [x] Production environment validator rejects mocks and incomplete legal identity.
- [x] Dependency installation is reproducible.
- [x] Prisma client generation passes.
- [x] Prisma schema validation passes.
- [x] Committed migration SQL matches the Prisma schema.
- [x] Seed data contains products, questions, score bands, referral settings, message templates and legal-review settings only.
- [x] ESLint passes with zero warnings.
- [x] TypeScript passes without errors.
- [x] Automated unit and security tests pass.
- [x] Next.js production build passes without warnings.
- [x] Required public, payment, report, referral, legal and admin routes exist.
- [x] Admin routes and admin APIs require authentication.
- [x] Razorpay and WhatsApp webhook HMAC verification is tested.
- [x] Referral self-attribution and duplicate rewards are prevented.
- [x] Paid report access and bilingual PDF output are tested.
- [x] Customer-facing source has no TODO, FIXME, TBD, “coming soon” or unfinished-configuration markers.
- [x] Security headers, robots, sitemap, manifest and private-route indexing rules are implemented.
- [x] Release, API, admin, security, QA and user documentation is committed.

Run the machine-verifiable subset with:

```bash
npm run verify:readiness
npm run verify:migration
npm run lint
npm run type-check
npm test
npm run build
```

## Repository publication

- [ ] Add the owner-approved GitHub remote.
- [ ] Push local `main` and all release commits.
- [ ] Protect `main` and require the CI verification job.
- [ ] Restrict repository and environment secret access to authorized maintainers.

## Production infrastructure

- [ ] Create the Vercel project from the approved repository.
- [ ] Provision managed PostgreSQL with SSL and least-privilege credentials.
- [ ] Enable daily backups, point-in-time recovery and a tested restore procedure.
- [ ] Add all production environment variables.
- [ ] Run `npx prisma migrate deploy` from one protected release job.
- [ ] Run the seed once and rotate the bootstrap admin password.
- [ ] Configure `vploanconnect.in`, HTTPS and DNS.

## Provider activation

- [ ] Configure Razorpay keys and webhook secret.
- [ ] Subscribe Razorpay to `payment.captured` and `payment.failed`.
- [ ] Configure an official OTP provider and confirm delivery/expiry behavior.
- [ ] Configure Meta WhatsApp Business Platform credentials.
- [ ] Approve and map all required WhatsApp templates.
- [ ] Configure WhatsApp webhook verification and app-secret signatures.

## Launch acceptance

- [ ] Confirm legal policies, GSTIN, business address and named grievance contact.
- [ ] Complete one sandbox payment for each paid product.
- [ ] Verify duplicate Razorpay webhook delivery remains idempotent.
- [ ] Complete OTP delivery and retry/expiry checks on real Indian mobile numbers.
- [ ] Verify report PDF download on desktop Chrome, macOS Safari, iPhone Safari and Android Chrome.
- [ ] Verify admin role permissions and authorized CSV export against production data.
- [ ] Verify referral attribution, validation period, refund reversal and payout reporting.
- [ ] Verify STOP prevents later promotional messages.
- [ ] Run accessibility, SEO and performance audits against the production URL.
- [ ] Confirm monitoring, alerting, log redaction and incident contacts.
