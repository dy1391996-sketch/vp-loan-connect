# Changelog

All notable changes to VP Loan Connect are documented here.

## 0.1.0 — 2026-07-23

### Added

- Premium mobile-first Hindi-English homepage and reusable fintech design system.
- Four-step OTP-ready loan-profile assessment with explicit consent.
- Transparent readiness scoring, EMI burden, document and credit-health results.
- Reducing-balance EMI calculator.
- Credit Health Action Plan and Complete Loan Readiness Report checkout flows.
- Razorpay server orders, signature verification, idempotent webhooks, failures, retries and refunds.
- Branded bilingual PDF reports with secure expiring downloads.
- Official WhatsApp Business Platform adapter and STOP withdrawal workflow.
- Referral attribution, fraud controls, rewards and customer dashboard.
- Role-based admin CRM, audit logs, CSV export, reports, payments, refunds and settings.
- Legal, consent, privacy, refund, deletion, contact and grievance routes.
- PostgreSQL/Prisma schema, initial migration and safe seed data.
- Security headers, production environment validation, CI and local release verification.
- Release, deployment, security, QA, API, admin and user documentation.

### Security

- Added secure cookie sessions, server-side authorization, input validation and same-origin checks.
- Added purpose-bound signed links for results and reports.
- Added Razorpay and Meta webhook HMAC verification.
- Added consent-purpose enforcement and idempotent marketing opt-out.
- Added duplicate webhook/reward prevention and restricted data export.
- Enforced patched PostCSS and Sharp dependency versions; release audit reports zero vulnerabilities.
