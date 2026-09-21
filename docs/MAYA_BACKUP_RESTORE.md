# Maya Backup and Restore

Maya is designed to survive model-provider changes, frontend redesigns, and app reinstalls. Memory lives in PostgreSQL `maya_*` tables (or an in-memory snapshot in tests), not inside the LLM.

## Backup

Owner UI/API: `POST /api/maya/backup`  
CLI (requires `DATABASE_URL`):

```bash
pnpm maya:backup
```

Writes `data/maya/backups/maya-backup-<timestamp>.json` (gitignored).

## Restore

Owner API: `POST /api/maya/restore` with either a full `snapshot` or an owner-scoped archive `json`.  
CLI:

```bash
pnpm maya:restore -- data/maya/backups/maya-backup-....json
```

Restore replaces Maya tables from the snapshot. It does not drop loan-product tables.

## Export

`GET /api/maya/export` and `GET /api/maya/export?format=markdown` give the owner a portable JSON + Markdown bundle (people, projects, loops, timeline, memories). Password hashes are redacted.

## Seed

`data/maya-seed-template.json` plus `POST /api/maya/seed` / `pnpm maya:seed -- file.json`.

Every seeded item is `SYSTEM_SEED`. Do not invent romantic events. Relationship *style* may be seeded; specific history requires verified owner information.

## Schema backup before this feature

`backups/pre-maya-life-system/schema.prisma` is a copy of the Prisma schema taken before Maya tables were added. The Maya migration is additive.
