# VP Nest AI Command Center

AI-powered booking, marketing and operations platform for **VP Nest – The Studio99Stay** (Gaur City Center, Greater Noida West).

This is not a basic chatbot. The Command Center unifies WhatsApp Business, Instagram, inventory, CRM, payments, content, housekeeping and analytics behind validated server-side tools.

## Stack

- Next.js 15 App Router · React 19 · TypeScript · Tailwind CSS 4
- PostgreSQL · Prisma ORM
- Official WhatsApp Cloud API · Instagram Messaging / Content Publishing APIs (Meta)
- OpenAI API (tool calling)
- Razorpay payment links + webhooks
- Cloudinary / Vercel Blob adapters for media
- Role-based staff auth · audit logs · sandbox provider modes

## Phase status

| Phase | Scope | Status |
|------:|-------|--------|
| 1 | Auth, studios, pricing, availability, customers, leads, bookings, payments, dashboard | **Implemented** |
| 2 | WhatsApp AI automation, unified inbox replies, follow-ups | Adapters + webhooks ready; AI reply loop next |
| 3 | Instagram DM / comments + WA handoff | Adapters ready |
| 4 | Content studio, calendar, publishing | Schema + pages + approval gates |
| 5 | Cleaning, maintenance, reviews automation | Schema + pages |
| 6 | Advanced AI reports & forecasting | Daily/weekly report cron + tools |

## Quick start

```bash
cp .env.example .env.local
pnpm install
pnpm db:generate
pnpm db:deploy
pnpm db:seed
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with the seeded owner account.

### Demo accounts (after seed)

| Role | Email | Password |
|------|-------|----------|
| Owner | value of `ADMIN_EMAIL` (default `owner@vpnest.local`) | `ADMIN_INITIAL_PASSWORD` (default `ChangeMeNow!123`) |
| Booking Manager | `booking@vpnest.local` | same |
| Social Media Manager | `social@vpnest.local` | same |
| Housekeeping | `housekeeping@vpnest.local` | same |
| Read-only | `readonly@vpnest.local` | same |

Rotate these passwords before any shared environment.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Architecture diagrams](docs/ARCHITECTURE_DIAGRAM.md)
- [Meta / WhatsApp setup](docs/META_INTEGRATION.md)
- [Instagram connection](docs/INSTAGRAM_CONNECTION.md)
- [WhatsApp templates](docs/WHATSAPP_TEMPLATES.md)
- [Razorpay setup](docs/RAZORPAY_SETUP.md)
- [OpenAI setup](docs/OPENAI_SETUP.md)
- [Deployment (Vercel)](docs/DEPLOYMENT.md)
- [API reference](docs/API.md)
- [Webhooks](docs/WEBHOOKS.md)
- [Backup & recovery](docs/BACKUP.md)
- [Security](docs/SECURITY.md)

## Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Provider sandbox modes

Set `*_PROVIDER=mock` locally for WhatsApp, Instagram, OpenAI, Razorpay and media. Production builds reject mock payment / WhatsApp / OpenAI providers.
