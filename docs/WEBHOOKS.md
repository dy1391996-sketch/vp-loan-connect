# Webhook documentation

## Meta (`GET|POST /api/webhooks/meta`)

### Verification (GET)
Query params from Meta:
- `hub.mode=subscribe`
- `hub.verify_token` must equal `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- `hub.challenge` echoed back as plain text

### Events (POST)
1. Read raw body
2. Verify `X-Hub-Signature-256` with `WHATSAPP_APP_SECRET` (required when secret configured)
3. Persist `WebhookEvent` with idempotency key (`entry.id` + timestamp / message id)
4. If duplicate unique key → status `DUPLICATE`, return 200
5. Route WhatsApp messages / Instagram messaging events into Customer + Conversation + Lead upserts

## Razorpay (`POST /api/webhooks/razorpay`)

1. Verify `X-Razorpay-Signature` HMAC with `RAZORPAY_WEBHOOK_SECRET`
2. Idempotency key = Razorpay `event.id` (or payment id + event type)
3. On captured/paid token payment → `confirmBookingFromPayment`
4. Never trust client-side checkout alone for confirmation

## Cron

All cron routes require `Authorization: Bearer $CRON_SECRET`.

| Path | Action |
|------|--------|
| `/api/cron/holds-expire` | Expire unpaid holds |
| `/api/cron/daily-report` | Generate daily owner report |
| `/api/cron/weekly-report` | Weekly analysis |
| `/api/cron/follow-ups` | Process due follow-ups |
| `/api/cron/content-publish` | Publish due approved content |
