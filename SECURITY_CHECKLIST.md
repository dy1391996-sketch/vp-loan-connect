# Security Checklist

Status date: 23 July 2026

## Application controls

- [x] Server inputs are validated with Zod.
- [x] Free results and paid reports use purpose-bound, expiring signed tokens.
- [x] Admin passwords are hashed with bcrypt.
- [x] Admin sessions are stored server-side by token hash and support revocation/expiry.
- [x] Admin page and API paths are protected by middleware and database session checks.
- [x] Sensitive admin actions have explicit role allowlists.
- [x] Same-origin checks protect browser mutation routes.
- [x] OTP request and verification limits are enforced.
- [x] Login, checkout and consultation limits are enforced.
- [x] Razorpay checkout signatures use HMAC-SHA256 and timing-safe comparison.
- [x] Razorpay webhooks verify the exact raw body before JSON processing.
- [x] Unique webhook event IDs prevent duplicate processing.
- [x] WhatsApp webhooks require Meta app-secret signatures in production.
- [x] STOP withdrawal is idempotent and stored in consent history.
- [x] Service and marketing consent are separate and marketing is optional.
- [x] Promotional WhatsApp sends require active marketing consent.
- [x] Consent wording, version, source, time, user agent and optional lawful IP are stored.
- [x] CSV export is restricted to `SUPER_ADMIN` and `ADMIN`.
- [x] Report downloads require a valid paid order and expiring signed link.
- [x] Referral rewards are unique per order and exclude self-referral/refunded orders.
- [x] Logs avoid OTPs, provider secrets and full sensitive payloads.
- [x] Mock OTP and payment providers are rejected in production.
- [x] No route accepts UPI PIN, CVV, bank password, net-banking credential or Aadhaar OTP.
- [x] npm dependency audit reports zero known vulnerabilities at release time.
- [x] Patched PostCSS and Sharp versions are enforced in npm and pnpm resolution.

## Browser and HTTP controls

- [x] Secure cookies are HTTP-only, same-site and production-secure.
- [x] Content Security Policy restricts scripts, frames, connections and embedding.
- [x] HSTS, `nosniff`, frame denial, referrer and permissions policies are set.
- [x] Admin, API, result, report, payment and dashboard paths are excluded from indexing.
- [x] Paid downloads use `private, no-store`.

## Data controls

- [x] PostgreSQL relational constraints and useful indexes are defined.
- [x] UUID identifiers are used for personal and transactional records.
- [x] Soft deletion and deletion-request tracking are modeled.
- [x] Provider payment/event identifiers are unique where required.
- [x] Admin mutations, exports, refunds and report regeneration write audit records.
- [x] IP storage for consent is disabled by default.

## Production owner controls

- [ ] Store secrets only in Vercel/provider secret stores.
- [ ] Use separate runtime and migration database accounts.
- [ ] Enable encrypted backups and complete a restore drill.
- [ ] Add distributed rate limiting for multi-instance OTP/login/payment protection.
- [ ] Configure production log redaction, retention and access reviews.
- [ ] Rotate signing/provider secrets on a documented schedule.
- [ ] Restrict Vercel, GitHub, Razorpay, Meta and database accounts with MFA.
- [ ] Configure vulnerability/dependency alert ownership.
- [ ] Complete privacy/legal review and incident-response contacts.
- [ ] Perform an independent penetration test before high-volume acquisition.

## Verification commands

```bash
npm run verify:readiness
npm run verify:migration
npm run lint
npm run type-check
npm test
npm run build
```
