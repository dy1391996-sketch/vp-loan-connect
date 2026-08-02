# WhatsApp template setup

Templates are required for messages sent **outside** the 24-hour customer service window.

## Recommended starter templates

Create these in Meta Business Manager → WhatsApp → Message templates. Keep bodies short and policy-compliant.

| Key (in app) | Category | Purpose |
|--------------|----------|---------|
| `welcome_followup` | Utility | Follow up if customer went quiet after enquiry |
| `payment_reminder` | Utility | Reminder before temporary hold expires |
| `booking_confirmed` | Utility | Confirmed booking summary |
| `pre_arrival` | Utility | Location + check-in reminder + ID request |
| `checkout_reminder` | Utility | Checkout time reminder |
| `review_request` | Marketing* | Google review / Instagram follow (*marketing consent) |
| `opt_out_confirmation` | Utility | Confirm STOP |

\* Marketing templates require opt-in. Never send review/promo templates to opted-out customers.

## Languages

Provide EN and HI (or Hinglish-friendly EN) variants as separate templates if needed. Meta does not auto-translate.

## Mapping in VP Nest

Seeded `MessageTemplate` rows store internal keys. Set `metaTemplateName` to the exact approved template name in Meta before enabling live sends.

## Quality tips

- Avoid promotional language in Utility templates
- Use variables sparingly
- Pause sending if template quality drops (Meta may pace/pause poor templates)
