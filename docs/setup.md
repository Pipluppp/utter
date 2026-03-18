# Setup

Read this when you need local development running.

## Prerequisites

- Node.js 20+
- npm
- Supabase CLI
- Docker
- Wrangler auth if you plan to deploy

## Install

```bash
npm install
npm --prefix frontend install
npm --prefix workers/api install
```

## Configure

Copy once:

- `workers/api/.dev.vars.example` -> `workers/api/.dev.vars`
- `frontend/.env.example` -> `frontend/.env.local` if you do not already have one

Required API Worker secrets live in `workers/api/.dev.vars`. At minimum:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STORAGE_SIGNING_SECRET`

Provider and billing flows need extra keys such as `DASHSCOPE_API_KEY` and Stripe secrets.

## Run

Terminal 1:

```bash
supabase start
```

Terminal 2:

```bash
npm --prefix workers/api run dev
```

Terminal 3:

```bash
npm --prefix frontend run dev
```

Local URLs:

- Frontend: `http://localhost:5173`
- API Worker: `http://127.0.0.1:8787/api`

## Local Runtime Notes

- `workers/api` uses `wrangler dev --local`.
- Queue and R2 bindings are defined at top level in `workers/api/wrangler.toml`.
- Wrangler `vars`, `r2_buckets`, and `queues` are non-inheritable. Keep each env explicit.
- Frontend requests `/api/*` and defaults to the local API Worker origin.

## Quick Checks

- `http://127.0.0.1:8787/api/health` returns `{ "ok": true }`
- frontend loads at `http://localhost:5173`
- `GET /api/languages` resolves through the frontend and reports qwen-backed language metadata

## Verification Commands

```bash
npm --prefix frontend run ci
npm --prefix workers/api run typecheck
npm --prefix workers/api run check
supabase test db
npm run test:worker:local
```

## Read Next

- [backend.md](./backend.md)
- [database.md](./database.md)
- [deploy.md](./deploy.md)
