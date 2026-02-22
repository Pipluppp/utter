# Backend: Supabase Edge Functions

Last updated: **2026-02-22** (migration completed 2026-02-17)

This doc describes Utter's backend architecture:

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

## API endpoints

All endpoints are implemented in `supabase/functions/api/routes/`:

- `POST /api/clone` — upload reference audio + create voice
- `POST /api/generate` — start generation task (returns task_id)
- `GET /api/tasks/{task_id}` — poll task status
- `POST /api/tasks/{task_id}/cancel` — cancel running task
- `GET /api/voices` — list user's voices
- `DELETE /api/voices/{voice_id}` — delete voice + storage
- `GET /api/voices/{voice_id}/preview` — signed URL for reference audio
- `GET /api/generations` — list user's generations
- `DELETE /api/generations/{generation_id}` — delete generation + storage
- `POST /api/generations/{generation_id}/regenerate` — get params to re-run
- `GET /api/languages` — supported languages + provider info
- `POST /api/voices/design/preview` — generate design preview (async task)
- `POST /api/voices/design` — save designed voice
- `POST /api/transcriptions` — batch transcription (Mistral Voxtral)
- `GET /api/me` — current user profile
- `PATCH /api/profile` — update profile

## Backend architecture

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

A single "fat function" (`api`) with Hono router handles all requests:

- Function name: `api`
- Entry point: `supabase/functions/api/index.ts`
- Local URL: `http://localhost:54321/functions/v1/api`
- Production URL: `https://jgmivviwockcwjkvpqra.supabase.co/functions/v1/api`

Route files live in `supabase/functions/api/routes/`. Shared utilities (auth, CORS, Modal client, Supabase client) live in `supabase/functions/api/_shared/`.

## Routing strategy (stable API contract)

The frontend calls `/api/*` paths. In production, Vercel rewrites these to Supabase Edge Functions (see `frontend/vercel.json`). In local dev, Vite proxies to `localhost:54321/functions/v1`.

## Auth + security model

- Clients use the publishable anon key + a user JWT from Supabase Auth
- The `requireUser()` helper in `_shared/auth.ts` validates the JWT and returns the user context
- Edge functions create a Supabase client scoped to the user's JWT so RLS applies automatically
- The service role key is used only for server-owned writes (task updates, generation inserts)
- `verify_jwt` is set to `false` in config (auth is handled in-function by Hono middleware)

## CORS

Edge functions handle CORS explicitly via `_shared/cors.ts`:
- Responds to `OPTIONS` preflight
- Includes `Access-Control-Allow-*` headers on all responses
- Currently allows all origins (`*`); production lockdown is planned (see `docs/2026-02-22/cors-lockdown.md`)

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

## Implementation history

Migration completed 2026-02-17. Implementation order was:
1. Schema + RLS + buckets + policies (`database.md`)
2. Edge API skeleton + auth + CORS
3. Read-only endpoints (`GET /voices`, `GET /generations`, `GET /tasks/:id`)
4. Write endpoints (`/clone`, `/generate`, deletes)
5. Parity validation with React SPA
6. Hosting rewrites (Vercel) + production deployment

Phase-by-phase guides: [`supabase-migration/phases/`](./supabase-migration/phases/)

