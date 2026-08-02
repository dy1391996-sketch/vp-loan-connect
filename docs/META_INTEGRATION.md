# Meta integration guide (WhatsApp + Instagram)

Official APIs only. Do **not** use WhatsApp Web automation, unofficial libraries or browser scraping.

## Prerequisites

1. Meta Business Portfolio
2. WhatsApp Business Account + Cloud API phone number
3. Instagram Professional account linked to a Facebook Page
4. Meta Developer App with WhatsApp and Instagram products

## WhatsApp Cloud API

### Permissions
- `whatsapp_business_messaging`
- `whatsapp_business_management`
- `business_management`

### Messaging window
- When a customer messages you, a **24-hour customer service window** opens.
- Inside the window: free-form service messages are allowed.
- Outside the window: only **pre-approved template messages**.

### Environment
```
WHATSAPP_PROVIDER=meta
WHATSAPP_API_URL=https://graph.facebook.com/v22.0
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_WEBHOOK_VERIFY_TOKEN=...
WHATSAPP_APP_SECRET=...
```

### Webhook
Callback URL: `https://YOUR_DOMAIN/api/webhooks/meta`  
Subscribe to `messages` on the WhatsApp Business Account.

Verify token must match `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.  
Signatures are checked with `X-Hub-Signature-256` and `WHATSAPP_APP_SECRET`.

## Instagram Messaging API

### Requirements
- Professional (Business/Creator) account
- Linked Facebook Page
- Permissions such as `instagram_manage_messages`, `instagram_basic`, page metadata scopes
- App Review for production / advanced access when messaging accounts you do not own

### Limits
- Standard replies generally require a recent user-initiated conversation (~24h window)
- Group messaging is not supported
- Pace automated DMs to respect Meta rate limits

### Environment
```
INSTAGRAM_PROVIDER=meta
INSTAGRAM_ACCESS_TOKEN=...
INSTAGRAM_BUSINESS_ACCOUNT_ID=...
INSTAGRAM_PAGE_ID=...
```

## Instagram Content Publishing

1. Create media container: `POST /{ig-user-id}/media`
2. Publish: `POST /{ig-user-id}/media_publish`
3. Permission: `instagram_content_publish` / business content publish (App Review required for production)
4. Typical publish caps apply (commonly ~50/24h) — treat as a soft operational limit

### Product rules
- Default content mode: **Draft** (human approval)
- Pricing, discount, legal, complaint or sensitive posts always require approval
- Trusted auto-publish only for pre-approved categories

## Sandbox

With `WHATSAPP_PROVIDER=mock` and `INSTAGRAM_PROVIDER=mock`, webhooks still accept verified/local payloads and adapters log outbound messages without calling Meta.
