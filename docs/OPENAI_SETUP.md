# OpenAI setup

## Environment

```
OPENAI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
```

## Safety model

The customer-facing assistant uses the system prompt in `src/lib/constants.ts` (`AI_SYSTEM_PROMPT`).

Critical actions go through `executeAITool()` in `src/lib/ai/tools.ts`:
- No direct SQL / Prisma from the model
- Zod validation on every tool argument
- Discounts only from approved `PricingRule` rows
- Payment confirmation only when webhook-verified `Payment` status is `PAID`
- Human handover tool pauses AI on the conversation

## Prompt injection

- User text is redacted for obvious PII before logging
- Tool allowlist is fixed (`AI_TOOL_NAMES`)
- Uncertain answers should escalate via `createSupportTicket` / `assignHumanAgent`

## Mock mode

`OPENAI_PROVIDER=mock` returns deterministic short replies for local demos without spending tokens.
