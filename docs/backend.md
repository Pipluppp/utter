# Backend plan: FastAPI -> Supabase Edge Functions

Last updated: **2026-02-05**

This doc maps Utter's current FastAPI backend to a Supabase-first backend:

- Edge Functions (API + orchestration)
- Postgres (durable state + RLS)
- Storage (audio objects + signed URLs)

Related docs:
- Architecture (comprehensive reference): [`architecture.md`](./architecture.md)
- Milestones: [`milestone.md`](./milestone.md)
- Supabase grounding + workflows: [`supabase.md`](./supabase.md)
- Schema + RLS + migrations: [`database.md`](./database.md)
- Orchestration model: [`edge-orchestration.md`](./edge-orchestration.md)
- Current behaviors/contracts: [`features.md`](./features.md)

## Current backend inventory (FastAPI)

FastAPI endpoints (from `backend/main.py`):

- `POST /api/clone` (upload reference audio -> create voice)
- `POST /api/generate` (start generation task)
- `GET /api/tasks/{task_id}` (poll task)
- `POST /api/tasks/{task_id}/cancel` (cancel)
- `GET /api/voices` (list)
- `DELETE /api/voices/{voice_id}` (delete)
- `GET /api/voices/{voice_id}/preview` (stream reference audio)
- `GET /api/generations` (list)
- `DELETE /api/generations/{generation_id}` (delete)
- `POST /api/generations/{generation_id}/regenerate` (new generation from existing)
- `GET /api/languages` (supported languages)
- `POST /api/voices/design/preview` (generate preview audio from description)
- `POST /api/voices/design` (save designed voice)
- `POST /api/transcriptions` (batch transcription, optional)
- `WS /api/transcriptions/realtime` (realtime transcription proxy, optional)

Non-API responsibilities today:
- local files under `backend/uploads/**` served via `/uploads/**`
- in-memory task state (`TaskStore`)

## Target backend architecture (Supabase)

### Durable state

Postgres tables (see `database.md`):
- `voices`
- `generations`
- `tasks` (canonical task state; replaces `TaskStore`)

### Audio objects

Supabase Storage buckets:
- `references` (private)
- `generations` (private)

DB stores Storage object keys, and the API issues signed URLs (or redirects) for playback/download.

### API runtime

Supabase Edge Functions replace FastAPI endpoints. Per Supabase guidance, prefer a "fat function" with internal routing:

- Function name: `api`
- Local URL: `http://localhost:54321/functions/v1/api`
- Deployed URL: `https://<project-ref>.supabase.co/functions/v1/api`

Frontend reachability options:
- Preferred: CDN rewrite so the SPA can keep calling `/api/*`
- Fallback: update the SPA to call `/functions/v1/api/*`

## Routing strategy (stable API contract)

We want the frontend contract to stay close to today's shapes under `features.md`.

Proposed approach:
- build a single Edge Function `api` and implement routing based on:
  - `req.method`
  - normalized `pathname`

Example route table (conceptual):

| Method | Route | Handler | Notes |
|---|---|---|---|
| `POST` | `/clone` | `cloneVoice()` | likely 2-step upload + finalize |
| `POST` | `/generate` | `startGeneration()` | creates `generation` + `task`, submits Modal job |
| `GET` | `/tasks/:id` | `getTask()` | polls Modal + idempotently finalizes |
| `POST` | `/tasks/:id/cancel` | `cancelTask()` | best-effort cancel + DB state |
| `GET` | `/voices` | `listVoices()` | thin wrapper around DB |
| `DELETE` | `/voices/:id` | `deleteVoice()` | delete DB + Storage objects |
| `GET` | `/voices/:id/preview` | `voicePreview()` | signed URL or redirect |
| `GET` | `/generations` | `listGenerations()` | thin wrapper around DB |
| `DELETE` | `/generations/:id` | `deleteGeneration()` | delete DB + Storage object |
| `POST` | `/generations/:id/regenerate` | `regenerate()` | wrapper around `startGeneration()` |
| `GET` | `/languages` | `languages()` | can be public |
| `POST` | `/voices/design/preview` | `designPreview()` | task-backed or sync (decision) |
| `POST` | `/voices/design` | `designSave()` | stores a "designed" voice |
| `POST` | `/transcriptions` | `transcribeBatch()` | optional; can be "future" |

## Auth + security model

Supabase default posture:
- clients use a publishable/anon key
- authenticated requests include a JWT
- RLS enforces row-level access

For our Edge API:
- Protected endpoints should require a valid JWT.
- The Edge Function should create a Supabase client that forwards the user's JWT so RLS is applied automatically.
- Use the service role key only for explicitly server-owned workflows, never for user-scoped reads/writes.

Function configuration:
- `verify_jwt` defaults to true; disable only for truly public endpoints (e.g., `/languages`).

## CORS (required for browser access)

Edge Functions must handle CORS explicitly:
- respond to `OPTIONS` preflight
- include `Access-Control-Allow-*` headers on all responses

Supabase documents a small CORS helper (`corsHeaders`) in the HTTP methods guide. Use that pattern rather than hand-rolling headers in every handler.

## File upload + download flows (Storage-first)

Important: do not proxy 50MB uploads through Edge Functions.

Recommended flows:

### Upload reference audio (clone)

Two-step:
1) `POST /clone/upload-url` (or reuse `POST /clone` with a mode)
   - Edge validates intent, returns a signed upload URL + object key
2) browser uploads directly to Storage
3) `POST /clone/finalize`
   - Edge validates the uploaded object (size/type/duration as needed)
   - writes the `voices` row
   - optionally kicks off transcription (sync or task-backed)

### Playback (voice preview, generation audio)

Preferred:
- return a signed URL from the API (JSON), or
- return a `302` redirect to the signed URL (to preserve "audio src points at API" ergonomics)

## Task + generation state machine (high-level)

The "generate" flow must be correct under:
- retries
- refreshes
- concurrent polling from multiple tabs

This implies:
- task state lives in `tasks`
- generation state lives in `generations`
- finalization is idempotent (see `edge-orchestration.md`)

Where we may need database help:
- concurrency guards (only one finalizer wins)
- atomic transitions (`processing` -> `completed`) with an invariant on `result`

If PostgREST updates are not sufficient, prefer a Postgres function (RPC) before adding direct DB connections from Edge.

## WebSockets (realtime transcription)

Supabase Edge Functions support WebSockets (see the official WebSockets guide).

Practical constraints for our `/api/transcriptions/realtime` port:
- Browser WebSockets cannot send custom headers reliably, so the default JWT verification flow is awkward.
- The Supabase docs recommend passing the JWT via query params or a custom protocol when needed.
- For better security, we should prefer a short-lived "ws ticket" minted by an authenticated HTTP endpoint, then exchange that ticket for a user session server-side.

Local development nuance:
- For WebSocket testing, Supabase CLI may terminate function instances after the HTTP request ends.
- The docs call out `edge_runtime.policy = \"per_worker\"` as necessary for local WebSocket testing.

This feature does not block the core clone/design/generate flows.

## Migration/cutover plan (practical)

Suggested implementation order:
1) Create schema + RLS + buckets + policies (`database.md`)
2) Build Edge API skeleton + auth + CORS (`supabase.md`, this doc)
3) Implement read-only endpoints (`GET /voices`, `GET /generations`, `GET /tasks/:id`)
4) Implement write endpoints (`/clone`, `/generate`, deletes)
5) Validate parity with the React SPA against the Edge backend
6) Cut over hosting rewrites and retire FastAPI for production

