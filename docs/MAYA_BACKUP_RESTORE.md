# Maya Backup and Restore

Maya is designed to survive model-provider changes, frontend redesigns, and app reinstalls. Memory lives in PostgreSQL `maya_*` tables (or an in-memory snapshot in tests), not inside the LLM.

## Backup

Owner UI/API: `POST /api/maya/backup`  
CLI (requires `DATABASE_URL`):

```bash
pnpm maya:backup
```

Writes `data/maya/backups/maya-backup-<timestamp>.json` (gitignored). CLI backups include owner password hashes for restore; they must stay local and must never be printed. HTTP `POST /api/maya/backup` redacts password hashes.

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

Every seeded item is `SYSTEM_SEED`. Do not invent romantic events, meetings, dates, calls, trips, physical interactions, promises, or shared experiences. Relationship *style* may be seeded. People, projects, events, preferences, and ongoing matters require `verified: true` and `ownerHistoryStatus` other than `not-provided`. The checked-in template is empty of owner history on purpose.

## Schema backup before this feature

`backups/pre-maya-life-system/schema.prisma` is a copy of the Prisma schema taken before Maya tables were added. The Maya migration is additive.
