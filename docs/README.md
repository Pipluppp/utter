# Utter docs

Canonical docs index for the active Cloudflare + Supabase runtime.

## Start here

1. `architecture.md` - topology, request/data flow, trust boundaries
2. `setup.md` - local development runbook
3. `deploy.md` - staging/prod deploy runbook and release gates
4. `backend.md` - API Worker route surface and runtime behavior
5. `database.md` - Postgres schema, RLS, and data invariants

## Current stack snapshot (2026-03-03)

- Frontend: Cloudflare Worker serving SPA assets
- API: Cloudflare Worker (`/api/*` contract retained)
- Storage: R2-only
- Async: Queue-first via Cloudflare Queues
- TTS provider: qwen-only
- System of record: Supabase Postgres/Auth/RLS/credits/billing

## Quick local run

```bash
# Terminal 1
supabase start

# Terminal 2
npm --prefix workers/api install
cp workers/api/.dev.vars.example workers/api/.dev.vars
npm --prefix workers/api run dev

# Terminal 3
cd frontend
npm install
test -f .env.local || cp .env.example .env.local
npm run dev
```

Local queue/R2 note:
- `workers/api/wrangler.toml` defines top-level local `r2_buckets` and `queues` bindings.
- Use `wrangler dev --local` (not `--remote`) for queue-backed local paths.

## Active work

- Current task hub: `tasks.md`
- 2026-03-02 continuation artifacts: `2026-03-02/`
- Simplification execution pack: `2026-03-02/remove-modal-supastorage-queue-simplify/`
- Security sweep planning pack: `2026-03-07/security-sweep-plan-bundle/`

## Core references

- `features.md` - feature and API contract reference
- `supabase-security.md` - Supabase-layer security controls
- `security/audits/2026-03-02/` - migration audit artifacts

## Historical docs

Legacy Modal/Supabase-Edge runtime docs are being removed as part of the Cloudflare-only cleanup.
