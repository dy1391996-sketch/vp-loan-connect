# Maya Instagram Integration

Status: adapter ready. No live posting or DM sending happens until official credentials and an explicit owner allowlist exist.

## Flow

```
Instagram webhook
  → GET hub.verify_token check
  → POST X-Hub-Signature-256 (required in production)
  → parse Messaging events
  → sender id ∈ MAYA_INSTAGRAM_OWNER_IDS ?
        yes → MayaBrain with private memories
        no  → public reply, no owner memory
  → optional Graph send if INSTAGRAM_PAGE_ACCESS_TOKEN is set
```

Route: `/api/webhooks/instagram/maya`

This uses official Meta webhooks / Graph API patterns only. Browser scraping and password automation are not implemented.

## Environment

- `MAYA_INSTAGRAM_OWNER_IDS` — comma-separated Instagram-scoped user ids
- `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`
- `INSTAGRAM_APP_SECRET`
- `INSTAGRAM_PAGE_ACCESS_TOKEN`
- `INSTAGRAM_GRAPH_API_URL` (default Graph v22.0)

Until those values are present, inbound events can be processed locally without sending replies.

Caption/DM personality and visual identity remain the same Maya Core / Master Maya. There is no separate Instagram character.
