# Security

## Controls implemented

- HTTP-only cookie sessions (`vpnest_admin`) with JWT purpose claim + DB session hash
- bcrypt password hashing
- Role-based permissions (Owner, Booking Manager, Social Media Manager, Housekeeping, Read-only)
- Audit log on authentication and mutating admin actions
- Zod validation on API inputs
- Rate limiting on login and admin APIs
- Webhook HMAC verification (Meta + Razorpay)
- Idempotent webhook + payment processing keys
- PII masking helpers for logs
- AI tool allowlist (no unrestricted DB access from the model)
- Provider secrets server-only

## Operational requirements

- Enforce HTTPS on production
- Restrict Vercel/env access to owners
- Enable DB backups
- Review Meta App Review screenshots before requesting advanced permissions
- Honour customer opt-out (`Customer.optedOut`) before outbound templates
- Never send lock PINs before payment + configured ID verification

## Reporting

Report suspected vulnerabilities to the business owner email configured in `SUPPORT_EMAIL`.
