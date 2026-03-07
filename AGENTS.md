# Agent notes (repo working guide)

This repo is a voice cloning + TTS app. The active runtime is Cloudflare + Supabase with a simplified stack:
- Cloudflare Workers for frontend and API runtime
- Cloudflare R2 for object storage
- Cloudflare Queues for async processing (queue-first)
- Supabase for Postgres/Auth/RLS/credits/billing source-of-truth
- Qwen as the only active TTS provider

## Coding guidelines

Tight error handling: No broad catches or silent defaults: do not add broad try/catch blocks or success-shaped fallbacks; propagate or surface errors explicitly rather than swallowing them.


## Layout

- `frontend/`: React 19 + Vite + TypeScript + Tailwind v4 SPA
- `workers/frontend/`: Cloudflare frontend Worker (assets + SPA + `/api/*` proxy)
- `workers/api/`: Cloudflare API Worker (`/api/*`)
- `supabase/`: Postgres migrations, SQL tests
- `docs/`: documentation (start with `docs/README.md`)

## Current deployed surfaces

- Frontend Worker: `https://utter.duncanb013.workers.dev`
- API Worker: `https://utter-api-staging.duncanb013.workers.dev/api`
- Supabase project: `utter-dev` (`jgmivviwockcwjkvpqra`)

## Local dev

Terminal 1 (Supabase local services):

```bash
supabase start
```

Terminal 2 (API Worker):

```bash
npm --prefix workers/api install
cp workers/api/.dev.vars.example workers/api/.dev.vars
npm --prefix workers/api run dev
```

Terminal 3 (Frontend):

```bash
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`

Queue/R2 local notes:
- Wrangler env keys like `vars` / `r2_buckets` / `queues` are non-inheritable.
- Local queue/R2 bindings are defined at top level in `workers/api/wrangler.toml`.
- Queue-backed local dev should run with `wrangler dev --local` (the default in `npm --prefix workers/api run dev`), not `--remote`.

## Frontend formatting + linting (Biome)

Biome is the formatter+linter for `frontend/src`:

- Verify: `npm --prefix frontend run check`
- Fix: `npm --prefix frontend run check:write`
- CI check: `npm --prefix frontend run ci`

Config lives at `frontend/biome.json`. VS Code integration lives in `.vscode/`.

Avoid adding ESLint/Prettier unless explicitly requested; Biome is the source of truth.

## Testing

```bash
# Database tests (pgTAP)
supabase test db

# Worker parity target (requires workers/api dev server)
npm run test:worker:local
```

## Docs pointers

- Project docs index: `docs/README.md`
- Architecture: `docs/architecture.md`
- Setup runbook: `docs/setup.md`
- Deploy runbook: `docs/deploy.md`
- API backend: `docs/backend.md`
- Database schema + RLS: `docs/database.md`
