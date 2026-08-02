# Razorpay setup

## Dashboard

1. Create a Razorpay account and activate Live mode when ready
2. Generate Key ID + Key Secret (Settings → API Keys)
3. Create a webhook secret (Settings → Webhooks)

## Environment

```
PAYMENT_PROVIDER=razorpay
RAZORPAY_KEY_ID=rzp_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

Never expose `RAZORPAY_KEY_SECRET` or webhook secret to the browser.

## Webhook

URL: `https://YOUR_DOMAIN/api/webhooks/razorpay`

Subscribe at least to:
- `payment.captured`
- `payment.failed`
- `payment_link.paid` (if using payment links)

## App behaviour

1. Booking creates a **temporary hold**
2. Server creates a Razorpay **payment link** for the token amount
3. Studio moves to `TOKEN_PENDING`
4. Webhook verifies HMAC signature
5. Event stored with **idempotency key** (duplicate deliveries are ignored)
6. Only then booking becomes `CONFIRMED`

Locally set `PAYMENT_PROVIDER=mock` to generate mock payment links without Razorpay.
