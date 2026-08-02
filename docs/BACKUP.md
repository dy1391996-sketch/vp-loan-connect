# Backup and recovery

## Database

1. Use your managed Postgres automatic backups (daily minimum; point-in-time if available)
2. Before risky migrations, take a manual snapshot
3. Store encrypted offsite copies of weekly dumps if compliance requires it

### Logical dump example

```bash
pg_dump "$DATABASE_URL" --format=custom --file=vpnest-$(date +%F).dump
```

### Restore example

```bash
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" vpnest-YYYY-MM-DD.dump
```

## Application secrets

- Keep Meta, Razorpay, OpenAI and DB credentials in Vercel/env vault only
- Rotate `NEXTAUTH_SECRET` only with a planned session invalidation window
- Revoke leaked WhatsApp / Instagram tokens immediately in Meta Business settings

## Media

If using Cloudinary or Vercel Blob, enable versioning / backup per provider docs. Studio media URLs in `StudioMedia` should remain valid after restore.

## Runbook

1. Restore DB snapshot
2. Redeploy last known good Vercel deployment
3. Re-verify webhook URLs + secrets
4. Run `pnpm verify:readiness`
5. Confirm a sandbox booking → payment → webhook path
