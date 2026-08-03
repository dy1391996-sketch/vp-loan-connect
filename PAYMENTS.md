# VP Loan Connect — Payment provider configuration

Switch gateways with `PAYMENT_PROVIDER` only. Business unlock logic (`processSuccessfulPayment`) stays provider-agnostic.

## Supported values

| `PAYMENT_PROVIDER` | Status |
|---|---|
| `razorpay` | Fully live-ready (existing flow preserved) |
| `cashfree` | Production-ready in code — needs Cashfree dashboard credentials + Vercel env before switch |
| `phonepe` | Pay + verify/webhook implemented — refund needs merchant API enablement |
| `payu` | Hosted pay + hash verify/webhook implemented — refund needs merchant API enablement |
| `mock` | Local/CI only — blocked in Vercel Production |

## Credentials to collect (do not invent keys)

### Razorpay
1. `RAZORPAY_KEY_ID` — Dashboard → Account & Settings → API Keys
2. `RAZORPAY_KEY_SECRET` — same pair as Key ID (test or live; never mix modes)
3. `RAZORPAY_WEBHOOK_SECRET` — Dashboard → Webhooks → secret for endpoint  
   URL: `https://www.vploanconnect.in/api/webhooks/razorpay`  
   (also available at `/api/webhooks/payments/razorpay`)  
   Events: `payment.captured`, `payment.failed`

### Cashfree Payments (backup / primary when Razorpay delayed)
1. `CASHFREE_APP_ID` — Merchant Dashboard → Developers → API Keys (**Production** keys)
2. `CASHFREE_SECRET_KEY` — same page (also used to verify webhooks if webhook secret unset)
3. `CASHFREE_WEBHOOK_SECRET` — optional; leave empty to use `CASHFREE_SECRET_KEY` (official PG signing secret)
4. `CASHFREE_ENV=production` — required when `PAYMENT_PROVIDER=cashfree` on Vercel Production  
   **Notify URL:** `https://www.vploanconnect.in/api/webhooks/payments/cashfree`  
   **Return URL:** generated as `/api/payments/return?order_id={order_id}&internalOrderId=…`  
   Suggested webhook events: `PAYMENT_SUCCESS_WEBHOOK`, `PAYMENT_FAILED_WEBHOOK`  
   **Do not** switch `PAYMENT_PROVIDER=cashfree` until Production App ID + Secret Key are set.

### PhonePe Payment Gateway
1. `PHONEPE_MERCHANT_ID`
2. `PHONEPE_SALT_KEY`
3. `PHONEPE_SALT_INDEX` (usually `1`)
4. `PHONEPE_ENV` — `sandbox` or `production`  
   Callback/webhook URL: `https://www.vploanconnect.in/api/webhooks/payments/phonepe`  
   Return URL is generated automatically via `/api/payments/return`

### PayU
1. `PAYU_KEY`
2. `PAYU_SALT`
3. `PAYU_ENV` — `test` or `production`  
   Success/failure return: `/api/payments/return`  
   Webhook URL: `https://www.vploanconnect.in/api/webhooks/payments/payu`

## Go-live checklist (Cashfree)

1. Create / approve Cashfree Production merchant account.
2. Copy Production `CASHFREE_APP_ID` + `CASHFREE_SECRET_KEY` into Vercel **Production** only.
3. Set `CASHFREE_ENV=production`.
4. Register webhook notify URL in Cashfree dashboard (above).
5. Set `PAYMENT_PROVIDER=cashfree` (only after keys are present).
6. Redeploy Vercel Production.
7. Open checkout once and confirm Cashfree production hosted checkout loads.
8. Complete one real ₹99 + GST payment only after explicit owner approval.
9. Confirm unlock, report download, admin payment row, and duplicate webhook/refresh safety.

## Architecture

- Interface: `src/lib/payments/types.ts`
- Factory: `src/lib/payments/index.ts` → `getPaymentProvider()`
- Adapters: `src/lib/payments/providers/{razorpay,cashfree,phonepe,payu,mock}.ts`
- Shared webhook processor: `src/lib/payments/webhook-handler.ts`
- Return/reconcile: `/api/payments/return`, `/api/payments/reconcile`
- Checkout UI reads `checkout.mode` and launches the correct UX (modal / SDK / redirect / hosted form)

## Safety rules

- No silent fallback between gateways after a failed attempt (avoids double charge).
- Historical orders always verify/refund through the **recorded** payment provider.
- Mock provider is blocked in Vercel Production.
- Amount and unlock are always server-side.
