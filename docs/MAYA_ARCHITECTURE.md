# Maya Architecture

Implemented in this repository as a private, owner-only subsystem of the existing Next.js 15 / Prisma / PostgreSQL app. The public VP Loan Connect product is unchanged.

## Stack

- Next.js App Router (`/maya`, `/api/maya/*`)
- TypeScript memory engine in `src/lib/maya`
- PostgreSQL tables added additively via Prisma (`maya_*`)
- In-memory store for tests (`MAYA_STORE=memory`)
- LLM provider abstraction: `mock` | `openai` | `anthropic`

## Owner scoping

Every conversation, memory, person, project, open loop, timeline event, relationship state, Instagram interaction, and visual asset is keyed by `ownerId`.

Unknown Instagram senders never load private memories. Web chat requires the `maya_owner` session cookie (`maya_owner_session` JWT).

## Request path

```
channel (web | Instagram | future adapters)
  → authenticate / allowlist
  → MayaBrain.respond
  → write pipeline (optional durable write)
  → retrieval (ranked, bounded)
  → context compiler
  → LLM provider
  → reply
```

There is one Maya brain. Channels do not get separate personalities.

## Identity

Versioned specs:

- `config/maya/MAYA_CORE.md`
- `config/maya/RELATIONSHIP_MODEL.md`
- `config/maya/VISUAL_IDENTITY.md`
- `config/maya/SAFETY_REALITY_RULES.md`
- `config/maya/VERSION` (currently `1.0.0`)

`MODEL != MAYA`. Identity, memory, state, and rules live outside the vendor model.

## Arya / Aira

No Arya or Aira persona, prompt, or identity was present in this repository. Nothing was removed from active execution.

## What is not implemented as live traffic

Instagram send/post is adapter-ready only. Replies are posted through Graph API only when `INSTAGRAM_PAGE_ACCESS_TOKEN` is set. No browser scraping. No password automation.
