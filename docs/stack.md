# Stack

Read this when you need the current runtime shape without the full architecture walkthrough.

## Active Stack

| Layer | Active choice | Code / config |
| --- | --- | --- |
| Frontend app | React 19 + Vite + TypeScript + Tailwind v4 | `frontend/package.json`, `frontend/src` |
| Frontend delivery | Cloudflare Worker serving `frontend/dist` | `workers/frontend/src/index.ts`, `workers/frontend/wrangler.toml` |
| API runtime | Cloudflare Worker + Hono under `/api` | `workers/api/src/index.ts`, `workers/api/package.json` |
| Async orchestration | Cloudflare Queues | `workers/api/src/queues`, `workers/api/wrangler.toml` |
| Object storage | Cloudflare R2 | `workers/api/wrangler.toml`, `workers/api/src/_shared/storage.ts` |
| Data / auth | Supabase Postgres + Auth + RLS | `supabase/migrations`, `supabase/tests` |
| TTS provider | Qwen | `workers/api/src/_shared/tts` |
| Payments | Stripe webhook + checkout | `workers/api/src/routes/billing.ts` |

## Repo Map

- `frontend/`: SPA routes, auth session refresh, task UI, marketing pages
- `workers/api/`: API routes, queue handlers, provider calls, signed storage URLs, credits and billing logic
- `workers/frontend/`: asset serving and `/api/*` proxying
- `supabase/`: schema, RPCs, RLS, pgTAP coverage
- `docs/`: canonical docs plus archive material

## External Services

- Cloudflare Workers
- Cloudflare R2
- Cloudflare Queues
- Supabase
- DashScope / Qwen
- Stripe

## Runtime Invariants

- Frontend talks to `/api/*`, not directly to provider services.
- Supabase is the source of truth for users, tasks, voices, generations, credits, and billing events.
- Queue-backed jobs are the default path for long-running generation and design preview work.
- Generated and reference audio live in R2, not in Postgres.
- The active provider is Qwen even though older schema history still contains `modal` compatibility fields.

## Read Next

- [architecture.md](./architecture.md)
- [backend.md](./backend.md)
- [database.md](./database.md)
