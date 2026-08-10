# Cashfree Payment Gateway setup — VP Loan Connect

This guide configures **Cashfree Payments** for the Credit Profile Booster **report / service fee** only.
Never describe checkout as a loan repayment, disbursement, guaranteed approval fee, or lender processing fee.

Cashfree merchant activation may still be under review. Keep `PAYMENT_PROVIDER` on the current live gateway until Production App ID + Secret Key are present in Vercel.

## Code status

| Layer | Status |
|---|---|
| Adapter (`src/lib/payments/providers/cashfree.ts`) | Ready — PG API version `2025-01-01` |
| Hosted checkout (server-driven full-page redirect) | Ready |
| Return + webhook finalization | Ready (server-verified unlock only) |
| Production credentials | **Owner action required** |
| Live site switch (`PAYMENT_PROVIDER=cashfree`) | **Do not flip until credentials + webhook are live** |

## Environment variables

### Local / Vercel Preview (sandbox)

```bash
PAYMENT_PROVIDER=cashfree
CASHFREE_ENV=sandbox
CASHFREE_APP_ID=<sandbox app id>
CASHFREE_SECRET_KEY=<sandbox secret>
CASHFREE_WEBHOOK_SECRET=   # optional; falls back to CASHFREE_SECRET_KEY
CASHFREE_API_VERSION=2025-01-01
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Aliases accepted by the app (mapped to APP_ID / SECRET_KEY):

- `CASHFREE_CLIENT_ID`
- `CASHFREE_CLIENT_SECRET`

Never put the Client Secret in `NEXT_PUBLIC_*`, the browser, chat, GitHub, or screenshots.

### Vercel Production (only after Cashfree activates Production)

```bash
PAYMENT_PROVIDER=cashfree
CASHFREE_ENV=production
CASHFREE_APP_ID=<production app id>
CASHFREE_SECRET_KEY=<production secret>
CASHFREE_WEBHOOK_SECRET=   # optional
CASHFREE_API_VERSION=2025-01-01
NEXT_PUBLIC_APP_URL=https://www.vploanconnect.in
```

Production build gates reject:

- `PAYMENT_PROVIDER=cashfree` with `CASHFREE_ENV=sandbox`
- missing App ID / Secret Key
- obvious placeholder credential values
- non-HTTPS `NEXT_PUBLIC_APP_URL`

## How checkout opens

`POST /pg/orders` returns a `payment_session_id`. The browser is then sent to Cashfree's hosted
payment page with a **top-level form POST**:

| `CASHFREE_ENV` | Checkout URL |
|---|---|
| `production` | `https://api.cashfree.com/pg/view/sessions/checkout` |
| `sandbox` | `https://sandbox.cashfree.com/pg/view/sessions/checkout` |

The only field sent is `payment_session_id` (plus the internal order id as `x_request_id` for tracing).
No amount is ever sent from the browser.

This is the same entry point the official Cashfree JS SDK uses for redirect checkout, but it is
performed directly so desktop and mobile behave identically. The SDK is intentionally not loaded:
it only redirects when the viewport is at least 768px wide and otherwise mounts an embedded iframe
whose promise can stay unresolved, which is what previously left the button spinning.

### CSP requirement

The checkout host **must** be listed in the site's CSP `form-action` directive
(`next.config.ts` → `CHECKOUT_FORM_ACTION_ORIGINS`). If it is missing, Chrome blocks the submission
with `Sending form data to … violates … form-action` and the payment page silently never opens.
`src/lib/payments/checkout-csp.test.ts` fails the build if this regresses.

### Domain whitelisting

Cashfree requires the live domain to be approved under **Dashboard → Developers → Whitelisting**
before the hosted checkout page will load for production traffic. Register
`https://www.vploanconnect.in`. Approval is usually within 24 hours and requires Contact,
Terms, and Refunds pages plus INR pricing to be visible on the site.

## Webhook URLs

Register **both** if Cashfree allows multiple endpoints, or pick one primary:

| Environment | URL |
|---|---|
| Production (canonical) | `https://www.vploanconnect.in/api/webhooks/payments/cashfree` |
| Production (alias) | `https://www.vploanconnect.in/api/payments/webhooks/cashfree` |
| Test / tunnel | `https://<your-test-domain>/api/webhooks/payments/cashfree` |
| Test alias | `https://<your-test-domain>/api/payments/webhooks/cashfree` |

Subscribe at minimum to:

- `PAYMENT_SUCCESS_WEBHOOK`
- `PAYMENT_FAILED_WEBHOOK`
- `PAYMENT_USER_DROPPED_WEBHOOK`
- Refund success / pending / cancelled events available in your Cashfree PG version

Signature verification uses the exact raw body:

`Base64(HMAC-SHA256(timestamp + rawBody, secret))`

with `x-webhook-signature` + `x-webhook-timestamp`.

## Sandbox end-to-end checklist

1. Switch Cashfree Merchant Dashboard to **Test**.
2. Copy sandbox Client ID / Client Secret into local or Vercel Preview env as `CASHFREE_APP_ID` / `CASHFREE_SECRET_KEY`.
3. Set `PAYMENT_PROVIDER=cashfree` and `CASHFREE_ENV=sandbox` for that environment only.
4. Configure the test webhook URL above and subscribe to payment + refund events.
5. Complete an assessment → checkout → Cashfree hosted checkout page (full-page redirect).
6. Confirm:
   - Order moves to `PAID` only after server verification (return handler and/or webhook).
   - Exactly one report entitlement is created for the order.
   - Success page requires a signed `report_access` token (opening `/payment/success` alone does not unlock).
7. Repeat a webhook delivery and confirm idempotent handling (`duplicate: true`).

## Production activation checklist

1. Wait until Cashfree activates the merchant account for **Production**.
2. Copy **Production** App ID + Secret into Vercel **Production** only (never Preview).
3. Set `CASHFREE_ENV=production`.
4. Register the production webhook URL(s).
5. Only then set `PAYMENT_PROVIDER=cashfree` on Vercel Production.
6. Redeploy Production after env updates.
7. Perform one low-value live control payment (owner-approved) for the service fee.
8. Verify settlement / reconciliation in Cashfree dashboard and Admin → Payments.

## Return URL pattern

Generated server-side (do not hardcode secrets):

`https://www.vploanconnect.in/api/payments/return?order_id={order_id}&internalOrderId=<uuid>`

Cashfree requires the literal `{order_id}` placeholder.

## Safety reminders

- Amounts and products are resolved on the server from product configuration — never trust browser amounts.
- Historical orders refund through the **recorded** payment provider on that payment row.
- No silent fallback to another gateway after a failed attempt (double-charge risk).
- Never paste Client Secret in chat, browser code, screenshots, GitHub, or `NEXT_PUBLIC_*` variables.
