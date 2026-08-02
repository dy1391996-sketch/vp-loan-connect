# VP Nest AI Command Center — System Architecture

**Business:** VP Nest – The Studio99Stay  
**Type:** Short-stay & 24-hour studio apartments  
**Location:** Gaur City Center, Greater Noida West  
**Channels:** WhatsApp Business + Instagram (official Meta APIs only)

---

## 1. System overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     VP Nest AI Command Center (Next.js)                  │
│  Auth · RBAC · Unified Inbox · CRM · Inventory · Content · Analytics     │
└────────────┬───────────────────────────┬───────────────────┬────────────┘
             │                           │                   │
     ┌───────▼───────┐           ┌───────▼───────┐   ┌───────▼───────┐
     │ Meta Webhooks │           │  OpenAI Tools │   │   Razorpay    │
     │ WA + IG + IG  │           │  validated    │   │  payment +    │
     │ comments      │           │  server fns   │   │  webhooks     │
     └───────┬───────┘           └───────┬───────┘   └───────┬───────┘
             │                           │                   │
             └─────────────┬─────────────┴───────────────────┘
                           ▼
                  ┌─────────────────┐
                  │   PostgreSQL    │
                  │  (Prisma ORM)   │
                  └────────┬────────┘
                           │
                  ┌────────▼────────┐
                  │ Redis / Cron    │
                  │ follow-ups,     │
                  │ reports, posts  │
                  └─────────────────┘
```

One **Customer** record unifies WhatsApp phone + Instagram scoped ID via `CustomerChannel`. All conversations, leads, bookings and payments hang off that customer.

---

## 2. Meta API constraints (verified)

### WhatsApp Cloud API
- **24-hour customer service window** after inbound message/call — free-form replies allowed inside the window.
- Outside the window: **pre-approved template messages only** (utility / marketing / authentication).
- Permissions: `whatsapp_business_messaging`, `whatsapp_business_management`, `business_management`.
- Opt-in required; respect STOP / opt-out.
- No unofficial WhatsApp Web automation.

### Instagram Messaging API
- Professional (Business/Creator) account linked to a Facebook Page.
- Permissions include `instagram_manage_messages`, `instagram_basic`, page metadata scopes.
- ~24-hour response window for standard DMs; group messaging unsupported.
- Automated DM rate limits apply (pace sends).

### Instagram Content Publishing
- Two-step container → `media_publish` Graph API flow.
- Requires `instagram_business_content_publish` (App Review for production).
- ~50 publishes / 24h typical cap; reels/stories have format constraints.
- Pricing, discounts, legal and complaint content **always require human approval** in our product rules.

---

## 3. Folder structure

```
/
├── docs/                     # Architecture, Meta, Razorpay, OpenAI, deploy guides
├── prisma/
│   ├── schema.prisma         # Full domain model
│   ├── migrations/
│   └── seed.ts
├── scripts/                  # Env validation, readiness checks
├── src/
│   ├── app/
│   │   ├── login/
│   │   ├── (command)/        # Authenticated Command Center pages
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   ├── admin/        # CRUD + actions (RBAC)
│   │   │   ├── tools/        # AI tool endpoints (server-validated)
│   │   │   ├── cron/         # Follow-ups, reports, content publish
│   │   │   └── webhooks/     # Meta, Razorpay (signature + idempotency)
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/
│   │   └── command/          # Shell, tables, forms, inbox widgets
│   └── lib/
│       ├── auth/             # Sessions, RBAC, audit
│       ├── domain/           # Pricing, availability, holds, bookings, leads
│       ├── ai/               # System prompt, tool registry, safety
│       ├── integrations/     # WhatsApp, Instagram, OpenAI, Razorpay, media
│       ├── security/         # Tokens, rate limit, PII mask, webhook verify
│       ├── env.ts
│       └── db.ts
└── vercel.json               # Cron schedules
```

---

## 4. API & webhook map

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/login` | Staff login |
| POST | `/api/auth/logout` | Revoke session |
| GET/POST | `/api/webhooks/meta` | WhatsApp + Instagram verify & events |
| POST | `/api/webhooks/razorpay` | Payment capture/fail (idempotent) |
| GET/POST | `/api/admin/*` | Studios, pricing, leads, bookings, payments, media, content, cleaning, analytics, settings, team, audit |
| POST | `/api/tools/*` | Validated AI tools (`searchAvailableStudios`, `createBooking`, …) |
| GET | `/api/cron/follow-ups` | Process due follow-ups (Vercel Cron + secret) |
| GET | `/api/cron/daily-report` | Generate owner daily report |
| GET | `/api/cron/weekly-report` | Weekly AI analysis |
| GET | `/api/cron/content-publish` | Publish approved scheduled posts |
| GET | `/api/cron/holds-expire` | Release unpaid temporary holds |

---

## 5. User journeys (Phase 1–2 core)

### A. WhatsApp booking (happy path)
1. Inbound WA message → webhook → create/update Customer + Conversation + Lead  
2. AI detects intent + language → collect date/time/duration/guests  
3. `searchAvailableStudios` + `calculateBookingPrice` (DB only)  
4. Recommend ≤3 studios with real media  
5. Customer selects → `createTemporaryHold` + `generatePaymentLink`  
6. Razorpay webhook → `verifyPayment` → confirm booking → confirmation messages  
7. Pre-arrival / checkout / cleaning / review workflows via cron  

### B. Instagram → WhatsApp handoff
1. IG DM/comment → answer + capture details → Lead (source=INSTAGRAM)  
2. Offer WhatsApp deep link with lead token  
3. WA conversation merges channels on same Customer  
4. Attribution: IG → WA → booking  

### C. Staff Command Center
Login → dashboard KPIs → unified inbox / leads / studios / bookings / payments → audit trail on mutations.

---

## 6. Environment variables

See `.env.example`. Critical groups:
- `DATABASE_URL`, `NEXTAUTH_SECRET`, `CRON_SECRET`
- Meta: WhatsApp + Instagram tokens, app secret, verify token
- `OPENAI_API_KEY`, `OPENAI_MODEL`
- Razorpay keys + webhook secret
- Cloudinary / Blob media credentials
- `REDIS_URL` (optional; in-memory fallback for single instance)
- Business identity + Google review / location URLs

---

## 7. Security plan

| Control | Implementation |
|---------|----------------|
| Auth | HTTP-only cookie JWT + DB session hash, bcrypt passwords |
| RBAC | `StaffRole` enum; page + API permission checks |
| Secrets | Server-only env; never sent to browser |
| Webhooks | HMAC / Meta `X-Hub-Signature-256`; idempotency keys |
| Rate limiting | Per-IP / per-user sliding window |
| Validation | Zod on all inputs |
| Audit | `AuditLog` for pricing, booking, payment, role, publish actions |
| PII | Mask phones/IDs in logs; opt-out flags on Customer |
| Prompt injection | Tool allowlist; never raw DB; sanitize user text into AI context |
| Access codes | Never sent before payment + ID policy satisfied |
| Payments | Confirm only after verified webhook / signature |

---

## 8. Phase-one implementation plan

**Goal:** Working booking foundation with real DB integration.

1. Full Prisma schema (all domain models; Phase 1 UI uses booking subset)  
2. Auth + Owner/Booking Manager/Social/Housekeeping/Read-only roles  
3. Studios CRUD + media metadata  
4. Configurable pricing rules (weekday/weekend slabs + overrides)  
5. Availability engine + temporary holds (race-safe)  
6. Customers + Leads CRM  
7. Bookings + Razorpay payment links (mock + live adapters)  
8. Command Center dashboard + Phase 1 admin pages  
9. Seed studios, pricing, demo owner  
10. Automated tests: pricing, availability, holds, bookings, webhook idempotency  

Phases 2–6 add WhatsApp AI, Instagram, content engine, operations, advanced analytics on this foundation.
