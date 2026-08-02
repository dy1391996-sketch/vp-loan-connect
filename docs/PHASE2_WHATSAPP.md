# Phase 2 — WhatsApp automation

## Flow

1. Meta webhook `POST /api/webhooks/meta` verifies signature + idempotency
2. `parseWhatsAppWebhookPayload` extracts inbound messages
3. `processWhatsAppInboundMessage` upserts Customer / Conversation / Message / Lead
4. `handleInboundCustomerMessage` runs intent + language + slot memory + tools
5. Outbound reply via WhatsApp Cloud API (or mock)
6. Staff can pause/resume AI, take handover, edit suggested replies in `/inbox`

## Messaging window

- Free-form replies only inside the 24-hour customer service window
- Follow-up cron uses free-form when the window is open; otherwise sends the configured **template** name
- Opt-out (`STOP`) cancels scheduled follow-ups

## Sandbox simulate

Authenticated `POST /api/admin/inbox/simulate` with `{ from, text, profileName }` runs the full pipeline without Meta (disabled when production + live WhatsApp provider).

## Human handover

Automatic when: human requested, refund, serious complaint, low confidence, repeated corrections, legal/safety language.
