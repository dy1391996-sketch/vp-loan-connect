# Phase 3 — Instagram DM/comments + WhatsApp handoff

## Architecture

Normalized inbound events (`NormalizedInboundEvent`) feed the existing Customer / Conversation / Message / Lead models for:

- `WHATSAPP` (unchanged Phase 2 pipeline + handoff consumption)
- `INSTAGRAM_DM`
- `INSTAGRAM_COMMENT`

Webhook: single endpoint `POST /api/webhooks/meta` (signature + idempotency).

## Handoff

1. Create `ChannelHandoff` with opaque token (hashed) + public `Ref`
2. First-party URL: `{APP_URL}/go/wa/{token}`
3. Click → record CLICKED → redirect **only** to `https://wa.me/...`
4. Prefill: `Hi, I'm continuing my Studio99Stay enquiry. Ref: ABCD1234`
5. WhatsApp inbound extracts `Ref:` → `CONSUMED` → link conversations + identity `ATTRIBUTED_HANDOFF`
6. No Ref → no guessing / no false merge

## Comment policy

- Booking/price/availability → private reply when API allows; else public “DM us” fallback
- Public acknowledgement only when private reply can be attempted
- Complaint / abuse / human → handover, no autonomous debate
- Spam → no AI reply

## Env (aliases supported)

| Variable | Notes |
|----------|-------|
| `INSTAGRAM_PROVIDER` | `mock` \| `meta` |
| `INSTAGRAM_ACCESS_TOKEN` | or alias `META_ACCESS_TOKEN` |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | required for live send |
| `INSTAGRAM_PAGE_ID` | or `FACEBOOK_PAGE_ID` |
| `WHATSAPP_APP_SECRET` | or `META_APP_SECRET` for webhook HMAC |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | or `META_VERIFY_TOKEN` |
| `SUPPORT_WHATSAPP` | E.164 used for click-to-chat |

Missing Instagram credentials: app builds; IG sends return `SKIPPED_PROVIDER_UNAVAILABLE` with missing variable names (never token values).

## Meta subscriptions

Callback: `https://vp-nest-ai.vercel.app/api/webhooks/meta`

Subscribe (when assets available):

- WhatsApp: `messages`
- Instagram / Page: messaging + comments fields as enabled by the app

Permissions typically required for live: `instagram_manage_messages`, `instagram_manage_comments`, page metadata scopes, App Review / Advanced Access as applicable.
