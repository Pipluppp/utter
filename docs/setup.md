# Setup Runbook

Last updated: 2026-03-03

Canonical local setup for the simplified Cloudflare + Supabase stack.

## Prerequisites

- Node.js 20+
- npm
- Supabase CLI
- Docker (for `supabase start`)
- Wrangler CLI auth if you plan to deploy or inspect remote resources

## 1) Install dependencies

From repo root:

```bash
npm install
npm --prefix frontend install
npm --prefix workers/api install
```

## 2) Start Supabase local services

```bash
supabase start
```

This provides local Postgres/Auth for Worker integration.

## 3) Configure API Worker local vars

```bash
cp workers/api/.dev.vars.example workers/api/.dev.vars
```

Fill required values in `workers/api/.dev.vars`:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (set to Supabase publishable key value)
- `SUPABASE_SERVICE_ROLE_KEY` (set to Supabase secret/service-role server key)
- `STORAGE_SIGNING_SECRET`
- provider/billing keys for flows you are testing (`DASHSCOPE_API_KEY`, Stripe, etc.)

## 4) Start API Worker (queue + R2 local mode)

```bash
npm --prefix workers/api run dev
```

Default URL: `http://127.0.0.1:8787`

Important:
- Queue-backed local dev should use local simulation (`wrangler dev --local`), not `--remote`.
- Local `R2` and `Queue` bindings are explicitly defined in top-level `workers/api/wrangler.toml` bindings.
- Wrangler env keys (`vars`, `r2_buckets`, `queues`) are non-inheritable; keep env-specific bindings explicit.

## 5) Start frontend dev server

```bash
cd frontend
test -f .env.local || cp .env.example .env.local
BACKEND_ORIGIN=http://127.0.0.1:8787 npm run dev
```

Frontend URL: `http://localhost:5173`

## Quick checks

- `GET http://127.0.0.1:8787/api/health` returns `{ "ok": true }`
- Worker dev startup logs show local `TTS_QUEUE`, `R2_REFERENCES`, `R2_GENERATIONS` bindings
- frontend loads at `http://localhost:5173`
- `/api/languages` resolves via frontend proxy and reports `provider: "qwen"`

## Troubleshooting

- `Missing env var` in API Worker:
  - ensure `workers/api/.dev.vars` exists and has required keys
- missing R2 or Queue binding:
  - confirm `workers/api/wrangler.toml` has top-level local `r2_buckets`/`queues`
  - do not rely on `--env staging` when running plain local dev
- CORS failures:
  - check `CORS_ALLOWED_ORIGIN` in Worker env and request origin
- signed media URL host mismatch:
  - verify frontend->API service binding forwarding headers are intact
