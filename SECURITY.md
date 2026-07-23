# Security policy

Report suspected vulnerabilities privately to the configured `SUPPORT_EMAIL`. Do not include live credentials, OTPs, bank data or unnecessary personal information in reports.

## Data handling rules

- Never request or store UPI PIN, CVV, banking passwords, Aadhaar OTP or net-banking credentials.
- Never log plaintext OTP values or provider secrets.
- Treat mobile, assessment, consent, order and report data as confidential.
- Use official payment, OTP and WhatsApp providers only.
- Keep marketing communication separate from required service communication.

## Production checklist

- Replace mock providers; application startup rejects mock OTP/payment in production.
- Configure managed distributed rate limiting for multiple instances.
- Enable managed database backups, point-in-time recovery and tested restoration.
- Enforce MFA/SSO at hosting, database, GitHub, Razorpay and Meta provider accounts.
- Rotate bootstrap admin and signing secrets.
- Review dependency advisories and update within the maintained Next.js 15 line or complete a tested major upgrade.
- Confirm webhook origin/signatures and use HTTPS only.
- Review audit logs, opt-outs and deletion requests on an assigned operational schedule.
