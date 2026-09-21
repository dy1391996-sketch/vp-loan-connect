# Maya Memory System

Authoritative memory is structured and relational (Prisma `maya_*` tables, or the equivalent in-memory snapshot used by tests). Vector search is not the source of truth. Retrieval is lexical plus recency, importance, entity match, and unresolved-loop boost, capped at a small set of memories.

## Layers

| Layer | Implementation |
| --- | --- |
| Working memory | Last messages on the current conversation |
| Episodic | Durable events actually discussed |
| Semantic | Relatively stable facts |
| People | `MayaPerson` entities; names are not auto-merged |
| Projects | `MayaProject` entities with latest update / status |
| Preferences | `PREFERENCE` memories |
| Relationship | Seeded style + `RELATIONSHIP` memories |
| Commitments | `MayaOpenLoop` |
| Emotional continuity | `MayaRelationshipState` conversational context only |
| Conversation summaries | Written after enough turns |
| Timeline | `MayaTimelineEvent` pointing at source memories |
| Correction history | Old row `superseded` / `corrected`, `supersededBy` set |

## Memory object

Durable rows include `memoryId`, `ownerId`, `type`, `subtype`, `content`, `normalizedFact`, source conversation/message ids, timestamps, `eventTime` with precision `exact | approximate | unknown`, confidence, importance, emotional weight, sensitivity, status, `supersededBy`, related people/projects/events, tags, and provenance.

Statuses: `active`, `uncertain`, `superseded`, `corrected`, `archived`, `deleted`.

Provenance: `REAL_USER_REPORTED`, `REAL_CONVERSATION`, `INFERENCE`, `ROLEPLAY`, `FICTION`, `SYSTEM_SEED`.

Role-play / fiction is never promoted to historical memory.

## Write pipeline

After each owner message the engine:

1. classifies durability (tea-level small talk is skipped)
2. detects role-play, correction, and forget intents
3. estimates importance and confidence
4. detects duplicates and contradictions
5. stores source references
6. updates people, projects, timeline, open loops, and summaries when warranted

## Retrieval

`retrieveRelevantContext` scores candidate historical memories and returns a short list. The compiler injects only that list plus people, projects, open loops, relationship state, and recent turns.

## Correction and deletion

- `correctMemory` preserves the old row and writes a new active row
- `forgetMemory` sets `status=deleted` in application storage
- Consolidation archives near-duplicate low-importance rows and never drops high-importance episodes just because they are old

## Export / backup

Owner APIs:

- `GET /api/maya/export` JSON + Markdown
- `POST /api/maya/backup`
- `POST /api/maya/restore`

CLI: `pnpm maya:backup`, `pnpm maya:restore -- file.json`, `pnpm maya:seed`, `pnpm maya:consolidate`
