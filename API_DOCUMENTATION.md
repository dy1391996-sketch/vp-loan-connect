# API Documentation

Base path: `/api`

All JSON endpoints use `application/json`. Browser mutation routes enforce same-origin requests. User routes use purpose-bound signed tokens; admin routes use the `vplc_admin` secure session cookie and role checks. Webhooks authenticate with provider signatures instead of browser sessions.

## Analytics

### `POST /api/analytics`

Records an allowlisted first-party event. Supported events include homepage visit, assessment start/completion, mobile verification, result view, checkout/payment, report download, referral copy/share and consultation request.

Response: `202` when accepted; `400` for invalid events.

## OTP

### `POST /api/otp/request`

Body:

```json
{
  "fullName": "Customer name",
  "mobile": "9876543210",
  "source": "direct"
}
```

Creates/updates a lead, rate-limits mobile and IP, stores a hashed OTP request and sends through the configured provider.

### `POST /api/otp/verify`

Body:

```json
{
  "requestId": "uuid",
  "mobile": "9876543210",
  "code": "123456"
}
```

Returns a short-lived `otpVerificationToken` after expiry, attempt and bcrypt checks.

## Assessment

### `POST /api/assessments`

Accepts the complete four-step assessment, OTP verification token, mandatory service consent, optional marketing consent, source, UTM data and optional referral code.

Returns:

```json
{
  "assessmentId": "uuid",
  "accessToken": "signed-token",
  "resultUrl": "https://www.vploanconnect.in/result/uuid?token=..."
}
```

The server calculates and stores the score, consent snapshots and referral attribution transactionally.

## Payments

### `POST /api/payments/create-order`

Requires a valid result token and completed assessment.

Body:

```json
{
  "assessmentId": "uuid",
  "productSlug": "credit-health-action-plan",
  "resultToken": "signed-token",
  "referralCode": "VPLC1234"
}
```

Creates the internal order first, creates a Razorpay order server-side and returns only the public checkout fields.

### `POST /api/payments/verify`

Accepts the internal order ID and Razorpay order/payment/signature fields. The server verifies the HMAC before marking the order paid, creating the report and returning a secure report token.

### `POST /api/payments/mock-complete`

Development only. Returns `404` in production and is unavailable unless `PAYMENT_PROVIDER=mock`.

## Reports

### `GET /api/reports/:id/download?token=...`

Requires a valid report token and paid order. Generates a branded PDF, updates report delivery status and returns `application/pdf` with private no-store headers.

## Consultation and lender referral

### `POST /api/consultations`

Requires a result token tied to the assessment. Stores the preferred slot and sanitized notes.

### `POST /api/lender-referrals`

Requires a paid report token and explicit lender-referral consent. Creates one active request and a versioned consent record. It does not select or promise a lender.

## Data deletion

### `POST /api/data-deletion`

Requires a verified mobile token and stores a deletion request for operational review.

## Provider webhooks

### `POST /api/webhooks/razorpay`

Requires `X-Razorpay-Signature`. The exact raw request body is verified with `RAZORPAY_WEBHOOK_SECRET`. Event IDs are unique, so retries return a duplicate acknowledgement without reprocessing.

Handled events:

- `payment.captured`
- `payment.failed`

### `GET /api/webhooks/whatsapp`

Handles Meta webhook subscription verification with `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.

### `POST /api/webhooks/whatsapp`

Requires `X-Hub-Signature-256` in Meta production mode. Inbound `STOP` withdraws marketing consent once and sends one service confirmation.

## Admin

### `POST /api/admin/login`

Validates email/password, rate-limits by hashed IP and issues an HTTP-only database-backed session cookie.

### `POST /api/admin/logout`

Revokes the current database session and removes the cookie.

### `GET /api/admin/export/leads`

Roles: `SUPER_ADMIN`, `ADMIN`. Returns an audited CSV containing the limited operational lead fields selected by the route.

### `PATCH /api/admin/leads/:id`

Roles: `SUPER_ADMIN`, `ADMIN`, `SUPPORT`. Updates stage, sanitized notes and optional last-contacted time; writes an audit log.

### `POST /api/admin/orders/:id/refund`

Roles: `SUPER_ADMIN`, `ADMIN`. Requires amount, reason and explicit confirmation. Calls the payment provider, records refund history and reverses referral reward status where applicable.

### `POST /api/admin/reports/:id/regenerate`

Roles: `SUPER_ADMIN`, `ADMIN`. Requeues a paid report and writes an audit record.

### `PATCH /api/admin/settings/referrals`

Roles: `SUPER_ADMIN`, `ADMIN`. Updates reward, validation, payout threshold and milestone bonus settings transactionally.

## Error behavior

- `400`: invalid input or provider signature.
- `401`: missing/invalid authentication or webhook signature.
- `403`: valid identity without required permission/consent.
- `404`: unavailable record or production-disabled mock endpoint.
- `429`: rate limit exceeded.
- `500`/`502`: safe generic processing/provider error; secrets and raw sensitive payloads are not returned.
