# Maya Privacy

Maya memory is sensitive personal data for a single owner.

Implemented controls:

- Owner session cookie `maya_owner` (httpOnly, SameSite=lax, secure in production)
- JWT purpose `maya_owner_session`, separate from admin sessions
- All stores filter by `ownerId`
- Instagram unknown senders use public mode with empty memory retrieval
- `/maya` and `/api/maya` are gated in middleware
- `/maya` is `noindex` and listed in `robots.txt` disallow
- Master visual is served only to the authenticated owner (`/api/maya/visual`)
- Application logs use `maya_event` without raw message bodies
- Secrets stay in environment variables (see `.env.example`); they are never committed. Prefer `MAYA_OWNER_PASSWORD_HASH` over plaintext. `pnpm maya:activate-owner` writes the hash only to gitignored `.env.local`.
- Export redacts password hashes
- Production Instagram webhooks require `INSTAGRAM_APP_SECRET` signatures
- Rate limits on login and chat
- Same-origin checks on mutating routes

Loan-product leads, payments, and assessments are not mixed into Maya memory.
