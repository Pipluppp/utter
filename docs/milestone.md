# Milestone: Supabase-first backend refactor

Last updated: **2026-02-05**

This is the top-level plan to move Utter from a local FastAPI backend (SQLite + local uploads + in-memory tasks) to a deployable **Supabase backend**:

- **DB**: Supabase Postgres (+ Row Level Security)
- **Files**: Supabase Storage (private buckets + signed URLs)
- **Auth**: Supabase Auth (JWT -> RLS)
- **Backend runtime**: Supabase Edge Functions (Deno) for orchestration + request validation
- **GPU jobs**: Modal (Qwen3-TTS) stays as the long-running execution layer

## Start here (linked deep-dives)

- **Architecture** (comprehensive reference — schema, RLS, Edge Functions, Auth, Storage): [`architecture.md`](./architecture.md)
- **Architecture explainer** (how the pieces work under the hood): [`architecture-learn.md`](./architecture-learn.md)
- Current behaviors + API shapes: [`features.md`](./features.md)
- Supabase grounding + CLI workflow: [`supabase.md`](./supabase.md)
- Backend API + Edge Functions routing: [`backend.md`](./backend.md)
- Database schema + RLS + migrations: [`database.md`](./database.md)
- Modal jobs -> Edge orchestration (poll-driven finalization): [`edge-orchestration.md`](./edge-orchestration.md)
- Billing + cost projections: [`deployment-architecture.md`](./deployment-architecture.md)

## Current state (today)

- Backend: FastAPI (`backend/main.py`), SQLite (`backend/utter.db`), local files (`backend/uploads/**`), in-memory `TaskStore`
- Frontend: React SPA in `frontend/` (dev proxy for `/api`, `/uploads`, `/static`)
- TTS: Modal.com job-based spawn/poll (durable job IDs, but task state is not durable today)

## Target state (Supabase)

- Replace FastAPI with Edge Functions + Postgres + Storage (no long-running server)
- Persist all task state in Postgres (`tasks` table); no in-memory state
- Store all audio in Storage (references + generations); serve via signed URLs
- Enforce isolation/security with RLS (tables + `storage.objects`)
- Keep the user-facing API stable via an API routing strategy (see `backend.md`)

## Non-goals (for this milestone doc)

- Frontend UI/UX refinements (only changes required for auth + new API base URL)
- Switching TTS engines (Modal/Qwen stays)

---

## Milestones (backend-focused)

### Milestone 0 - Freeze contracts (0.5-1 day)

- Lock the API request/response shapes used by the React app (use `features.md` as source of truth).
- Decide the production API base path strategy:
  - Option A: keep `/api/*` via a CDN rewrite to Supabase Functions
  - Option B: switch to Supabase's default `/functions/v1/*` and update the frontend
- Decide where to use PostgREST vs Edge Functions:
  - CRUD reads/writes -> PostgREST when safe + simple
  - anything involving files, orchestration, or multi-step invariants -> Edge Functions

### Milestone 1 - Supabase local dev + environments (0.5-1 day)

- Adopt Supabase CLI workflow (`supabase init`, `supabase start`) and commit the `supabase/` directory.
- Establish environment separation (dev/staging/prod) and a migration promotion workflow.
- Define secrets ownership + naming (`supabase secrets set ...`) for Modal + Mistral + Stripe.

### Milestone 2 - Database schema + RLS (1-3 days)

- Design Postgres schema for:
  - `voices`
  - `generations`
  - `tasks` (canonical task state machine)
- Write RLS policies for user-owned rows and harden the exposed data API surface.
- Decide how "admin/service" operations run (service role vs user JWT) and document it.

### Milestone 3 - Storage buckets + access model (1-2 days)

- Create buckets and object key conventions (deterministic, idempotent, user-scoped).
- Decide upload flow for large files (client direct-upload via signed URL vs Edge proxy upload).
- Add Storage access control policies aligned with RLS.

### Milestone 4 - Edge Functions scaffold (1-2 days)

- Choose function layout:
  - one routed "fat function" (recommended) vs multiple functions
  - shared code in `supabase/functions/_shared`
- Implement baseline concerns:
  - CORS handling
  - request validation + consistent error responses
  - auth/JWT verification configuration per function

### Milestone 5 - Endpoint migration (2-7 days)

Migrate FastAPI endpoints to Supabase primitives, preserving the UX contract ("start -> poll -> render result"):

- Voices: list/preview/delete
- Generations: list/delete/regenerate
- Clone: reference audio + transcript -> create voice
- Design: preview + save voice
- Generate: create generation + task + Modal job submit
- Tasks: poll + cancel (DB-backed)

### Milestone 6 - Orchestration hardening (2-5 days)

- Implement poll-driven finalization (idempotent under concurrent polling).
- Add cancellation semantics that are correct under retries/timeouts.
- Optional: Supabase Realtime subscriptions for task updates (reduce polling).

### Milestone 7 - Cutover + deployment (1-3 days)

- Apply migrations to staging, deploy functions, validate end-to-end.
- Add frontend hosting rewrites (CloudFront/Vercel/etc) to route API calls correctly.
- Add observability + cost controls (logs, error reporting, egress/storage tracking).

