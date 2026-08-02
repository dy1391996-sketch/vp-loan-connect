# Instagram connection guide

## Account requirements

1. Convert the business Instagram to a **Professional** account (Business or Creator)
2. Link it to a **Facebook Page**
3. Add the Instagram product to your Meta Developer App
4. Request messaging / content publish permissions; complete App Review for production

## Messaging

- Webhook: same Meta callback as WhatsApp — `POST /api/webhooks/meta`
- Subscribe to Instagram messaging webhooks on the Page / IG account
- Set:
  ```
  INSTAGRAM_PROVIDER=meta
  INSTAGRAM_ACCESS_TOKEN=...
  INSTAGRAM_BUSINESS_ACCOUNT_ID=...
  INSTAGRAM_PAGE_ID=...
  ```

## Lead handoff to WhatsApp

Product flow (Phase 3):
1. Answer the IG question
2. Capture date / duration / guests when possible
3. Create Lead with `source=INSTAGRAM_DM` or `INSTAGRAM_COMMENT`
4. Send WhatsApp deep link with lead context so the customer does not repeat details
5. Unify profiles via `CustomerChannel` (IG scoped id + WA phone on same Customer)

## Publishing

Use Content Studio drafts → human approval → schedule → cron `/api/cron/content-publish`  
Sensitive/pricing content always requires approval.

## Local sandbox

`INSTAGRAM_PROVIDER=mock` logs/publishes mock post ids without calling Graph API.
