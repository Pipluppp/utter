# Milestone: Supabase-first backend refactor

Last updated: **2026-02-22**

Utter migrated from a local FastAPI backend (SQLite + local uploads + in-memory tasks) to a **Supabase backend** deployed on 2026-02-17:

- **DB**: Supabase Postgres (+ Row Level Security)
- **Files**: Supabase Storage (private buckets + signed URLs)
- **Auth**: Supabase Auth (JWT + RLS)
- **Backend runtime**: Supabase Edge Functions (Deno/Hono) for orchestration + request validation
- **GPU jobs**: Modal (Qwen3-TTS) stays as the long-running execution layer
- **Frontend hosting**: Vercel (`https://utter-wheat.vercel.app`)

## Start here (linked deep-dives)

- **Architecture** (comprehensive reference — schema, RLS, Edge Functions, Auth, Storage): [`architecture.md`](./architecture.md)
- **Architecture explainer** (how the pieces work under the hood): [`architecture-learn.md`](./architecture-learn.md)
- Features + API shapes: [`features.md`](./features.md)
- Supabase grounding + CLI workflow: [`supabase.md`](./supabase.md)
- Backend API + Edge Functions routing: [`backend.md`](./backend.md)
- Database schema + RLS + migrations: [`database.md`](./database.md)
- Modal jobs -> Edge orchestration (poll-driven finalization): [`edge-orchestration.md`](./edge-orchestration.md)
- Billing + cost projections: [`deployment-architecture.md`](./deployment-architecture.md)

## Milestones (all complete)

| # | Milestone | Status |
|---|-----------|--------|
| 0 | Freeze API contracts | Done |
| 1 | Supabase local dev + environments | Done |
| 2 | Database schema + RLS | Done |
| 3 | Storage buckets + access model | Done |
| 4 | Edge Functions scaffold | Done |
| 5 | Endpoint migration | Done |
| 6 | Orchestration hardening | Done |
| 7 | Cutover + deployment | Done (2026-02-17) |

Phase-by-phase implementation guides are in [`supabase-migration/phases/`](./supabase-migration/phases/).

## What shipped

- Single "fat function" Edge Function (`api`) with Hono router
- All FastAPI endpoints ported to Edge Functions with full parity
- Postgres schema: `profiles`, `voices`, `generations`, `tasks` with RLS
- Storage buckets: `references`, `generated` with user-scoped policies
- Supabase Auth with magic link + password
- Vercel rewrites `/api/*` to Supabase Edge Functions
- CI: pgTAP database tests + Deno edge function tests

## Non-goals (for this milestone)

- Frontend UI/UX refinements (only changes required for auth + new API base URL)
- Switching TTS engines (Modal/Qwen stays)
- Credit enforcement / billing (future work)
