# VP Loan Connect — Payment provider configuration

Switch gateways with `PAYMENT_PROVIDER` only. Business unlock logic (`processSuccessfulPayment`) stays provider-agnostic.

## Supported values

| `PAYMENT_PROVIDER` | Status |
|---|---|
| `razorpay` | Fully live-ready (existing flow preserved) |
| `cashfree` | Fully implemented — needs credentials |
| `phonepe` | Fully implemented for pay + verify/webhook — refund needs merchant API enablement |
| `payu` | Fully implemented for hosted pay + hash verify/webhook — refund needs merchant API enablement |
| `mock` | Local/CI only |

## Credentials to collect (do not invent keys)

### Razorpay
1. `RAZORPAY_KEY_ID` — Dashboard → Account & Settings → API Keys
2. `RAZORPAY_KEY_SECRET` — same pair as Key ID (test or live; never mix modes)
3. `RAZORPAY_WEBHOOK_SECRET` — Dashboard → Webhooks → secret for endpoint  
   URL: `https://www.vploanconnect.in/api/webhooks/razorpay`  
   (also available at `/api/webhooks/payments/razorpay`)  
   Events: `payment.captured`, `payment.failed`

### Cashfree Payments
1. `CASHFREE_APP_ID` — Merchant Dashboard → Developers → API Keys
2. `CASHFREE_SECRET_KEY` — same page
3. `CASHFREE_WEBHOOK_SECRET` — optional but recommended (falls back to secret key if empty)
4. `CASHFREE_ENV` — `sandbox` or `production`  
   Webhook URL: `https://www.vploanconnect.in/api/webhooks/payments/cashfree`

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

## Go-live checklist

1. Set `PAYMENT_PROVIDER` to the gateway that has credentials ready first.
2. Paste only that provider’s secrets into Vercel Production env (no quotes).
3. Register the webhook URL in the provider dashboard.
4. Redeploy Vercel.
5. Run a ₹116.82 (₹99 + GST) test payment on `/assessment` → Unlock.

## Architecture

- Interface: `src/lib/payments/types.ts`
- Factory: `src/lib/payments/index.ts` → `getPaymentProvider()`
- Adapters: `src/lib/payments/providers/{razorpay,cashfree,phonepe,payu,mock}.ts`
- Shared webhook processor: `src/lib/payments/webhook-handler.ts`
- Checkout UI reads `checkout.mode` and launches the correct UX (modal / SDK / redirect / hosted form)
