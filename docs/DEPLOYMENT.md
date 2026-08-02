# Deployment guide (Vercel)

## 1. Database

Provision managed PostgreSQL (Neon, Supabase, RDS, etc.).  
Set `DATABASE_URL` with SSL as required by the provider.

## 2. Vercel project

1. Import the Git repository
2. Framework: Next.js
3. Install command: `pnpm install`
4. Build command: `pnpm db:generate && pnpm build`
5. Add all production env vars from `.env.example` (no mocks)

## 3. Migrations

Run against production (one-off / CI):

```bash
pnpm db:deploy
pnpm db:seed   # only for first bootstrap; protect ADMIN_INITIAL_PASSWORD
```

## 4. Cron jobs

`vercel.json` schedules:

| Path | Purpose |
|------|---------|
| `/api/cron/holds-expire` | Release unpaid temporary holds |
| `/api/cron/daily-report` | Owner daily report |
| `/api/cron/follow-ups` | Due follow-ups (Phase 2) |
| `/api/cron/content-publish` | Publish approved scheduled posts (Phase 4) |
| `/api/cron/weekly-report` | Weekly analysis |

Authorize with `Authorization: Bearer $CRON_SECRET`.

## 5. Webhooks

Configure Meta + Razorpay callback URLs to the production domain as documented in `META_INTEGRATION.md` and `RAZORPAY_SETUP.md`.

## 6. Post-deploy checks

- Owner login works
- Studios & pricing visible
- Create booking → payment link in mock/live
- Webhook signature rejection works with bad secret
- Cron endpoint rejects missing bearer token
