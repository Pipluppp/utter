# Utter

Voice cloning + TTS app powered by Qwen3-TTS.

Current runtime stack (as of 2026-03-03):
- Frontend delivery: Cloudflare Worker (`workers/frontend`)
- API runtime: Cloudflare Worker (`workers/api`)
- Object storage: Cloudflare R2 only (`references`, `generations`)
- Async orchestration: Cloudflare Queues (`tts-jobs-*`, DLQ)
- System of record: Supabase (Postgres + Auth + RLS + credits/billing)

## Repo layout

- `frontend/`: React 19 + Vite + TypeScript + Tailwind v4 SPA
- `workers/`: Cloudflare Workers (frontend and API)
- `supabase/`: Postgres migrations and SQL tests (system-of-record schema/RLS)
- `modal_app/`: historical archive (not part of active runtime)
- `docs/`: project documentation (start at `docs/README.md`)

## Current deployed surfaces

- Frontend Worker (staging/prod-like): `https://utter.duncanb013.workers.dev`
- API Worker: `https://utter-api-staging.duncanb013.workers.dev/api`
- Supabase project (system of record): `utter-dev` (`jgmivviwockcwjkvpqra`)

## Local development

Use three terminals.

1) Supabase local services:

```bash
supabase start
```

2) API Worker local runtime:

```bash
npm --prefix workers/api install
cp workers/api/.dev.vars.example workers/api/.dev.vars
npm --prefix workers/api run dev
```

Notes:
- Local queue/R2 bindings are configured in `workers/api/wrangler.toml` top-level bindings.
- Use `wrangler dev --local` (already in `npm --prefix workers/api run dev`), not `--remote`, for queue-backed local dev.

3) Frontend dev server:

```bash
cd frontend
npm install
test -f .env.local || cp .env.example .env.local
BACKEND_ORIGIN=http://127.0.0.1:8787 npm run dev
```

Frontend URL: `http://localhost:5173`

## Testing

```bash
# Database tests (pgTAP)
supabase test db

# Worker API parity target (requires workers/api dev on :8787)
npm run test:worker:local
```

## Frontend formatting and linting

Biome is the formatter/linter for `frontend/src`.

```bash
npm --prefix frontend run check
npm --prefix frontend run check:write
npm --prefix frontend run ci
```
