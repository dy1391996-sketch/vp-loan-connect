# API documentation (Phase 1)

Base URL: `NEXT_PUBLIC_APP_URL`

All `/api/admin/*` and `/api/tools/*` routes require the `vpnest_admin` session cookie.

## Auth

| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | `/api/auth/login` | `{ email, password }` | Sets HTTP-only cookie |
| POST | `/api/auth/logout` | — | Revokes session |

## Admin resources

| Method | Path | Permission |
|--------|------|------------|
| GET/POST | `/api/admin/studios` | studios:manage |
| GET/PATCH | `/api/admin/studios/:id` | studios:manage |
| GET/POST | `/api/admin/pricing` | pricing:manage |
| PATCH | `/api/admin/pricing/:id` | pricing:manage |
| GET/POST | `/api/admin/leads` | leads:manage |
| GET/PATCH | `/api/admin/leads/:id` | leads:manage |
| GET | `/api/admin/customers` | customers:view |
| GET/POST | `/api/admin/bookings` | bookings:manage |
| GET/PATCH | `/api/admin/bookings/:id` | bookings:manage |
| GET | `/api/admin/payments` | payments:manage |
| POST | `/api/admin/payments/create-link` | payments:manage |
| POST/DELETE | `/api/admin/holds` | bookings:manage |
| GET/POST | `/api/admin/team` | team:manage |
| GET/PATCH | `/api/admin/settings` | settings:manage |
| GET | `/api/admin/audit` | audit:view |

## AI tools

`POST /api/tools` body: `{ tool: string, args: object }`  
Executes a validated tool from `AI_TOOL_NAMES` (see architecture doc).

## Webhooks & cron

See [WEBHOOKS.md](./WEBHOOKS.md).
