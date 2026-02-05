# Supabase grounding (Utter backend)

Last updated: **2026-02-05**

This doc is the Supabase "source of truth" for our migration plan: how Supabase Postgres + Auth + Storage + Edge Functions fit Utter's requirements, and the workflows we should standardize so the plan is deployable.

Read order:
1) [`architecture.md`](./architecture.md) — comprehensive architecture reference
2) this doc — Supabase grounding + CLI workflows
3) [`backend.md`](./backend.md) and [`database.md`](./database.md) — implementation details

## Official Supabase docs (primary sources)

Database:
- https://supabase.com/docs/guides/database/overview
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/api (PostgREST / auto-generated REST API)
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/database/hardening-data-api

Edge Functions:
- https://supabase.com/docs/guides/functions
- https://supabase.com/docs/guides/functions/quickstart
- https://supabase.com/docs/guides/functions/architecture
- https://supabase.com/docs/guides/functions/connect-to-postgres
- https://supabase.com/docs/guides/functions/http-methods (routing + CORS)
- https://supabase.com/docs/guides/functions/websockets
- https://supabase.com/docs/guides/functions/auth (JWT verification)
- https://supabase.com/docs/guides/functions/secrets (env vars)
- https://supabase.com/docs/guides/functions/function-configuration (config.toml)
- https://supabase.com/docs/guides/functions/development-tips
- https://supabase.com/docs/guides/functions/troubleshooting
- https://supabase.com/docs/guides/functions/limits

CLI + local dev + migrations:
- https://supabase.com/docs/guides/local-development
- https://supabase.com/docs/guides/local-development/cli/getting-started
- https://supabase.com/docs/guides/local-development/overview (migrations workflow)
- https://supabase.com/docs/guides/local-development/declarative-database-schemas
- https://supabase.com/docs/reference/cli/introduction
- https://supabase.com/docs/guides/deployment/database-migrations
- https://supabase.com/docs/guides/deployment/managing-environments

Auth + Storage:
- https://supabase.com/docs/guides/auth
- https://supabase.com/docs/guides/storage
- https://supabase.com/docs/guides/storage/security/access-control
- https://supabase.com/docs/guides/storage/uploads (resumable uploads, etc)
- Storage signed upload URL API:
  - https://supabase.com/docs/reference/javascript/storage-createsigneduploadurl

## What "Supabase-first backend" means for Utter

Utter's deploy blockers today:
- local-only state: SQLite + filesystem + in-memory tasks
- no auth / no tenant isolation

Supabase replaces those pieces directly:

| Utter concern | Supabase primitive | Notes |
|---|---|---|
| Durable state | Postgres tables | `voices`, `generations`, `tasks` (see `database.md`) |
| User identity | Supabase Auth | JWT is the identity boundary |
| Authorization | RLS | policies for tables + `storage.objects` |
| Audio storage + delivery | Supabase Storage | private buckets + signed URLs |
| Backend APIs | Edge Functions (+ optional PostgREST) | orchestration in Edge |
| Long-running TTS | Modal jobs | Edge orchestrates, Modal executes |

## Edge Functions: constraints and limits that shape our design

Constraints that matter for Utter:
- Stateless: no in-memory task store; state must be in Postgres.
- Limited CPU / cold starts: do network I/O + DB writes; avoid heavy compute.
- No HTML serving: Edge Functions are APIs, not a templating server.
- CORS is manual: we must implement `OPTIONS` and add CORS headers.
- Timeouts exist: do not assume one request "finishes the job".

Key runtime limits to design around (see the official limits doc):
- Max memory: 256MB
- Max duration (wall clock): Free 150s, Paid 400s
- Max CPU time per request: 200ms (excludes async I/O)
- Request idle timeout: 150s (a request must send a response within this window)

The official limits doc is the source of truth. For architecture planning, the key outcomes are:
- We should use **poll-driven finalization** (not "one long function call").
- We should avoid proxying large uploads through Edge Functions.
- We should keep responses small (signed URLs, not raw audio bytes).

Because Utter uses Modal's spawn/poll model, the most robust Edge design is:
- [`edge-orchestration.md`](./edge-orchestration.md)
  - `POST /generate` submits a Modal job and returns quickly.
  - `GET /tasks/:id` polls and finalizes idempotently when the job completes.

## PostgREST vs Edge Functions (how we decide)

PostgREST (auto-generated REST API) is great when:
- the operation is simple CRUD on a table/view
- RLS fully captures the authorization rules
- there are no files, no third-party calls, no multi-step invariants

Use Edge Functions when:
- the operation is multi-step and must be atomic/idempotent
- it needs Modal/Mistral/Stripe calls
- it needs Storage signed URL creation, uploads, or object key conventions
- it needs stable request validation + error contracts

Default stance for the migration:
- preserve today's `/api/*` contract via an Edge API router (see `backend.md`)
- optionally adopt direct PostgREST reads later (after RLS + hardening is mature)

## Connecting Edge Functions to Postgres (what actually works)

There are two broad ways to talk to Postgres from Edge Functions.

### A) Recommended default: `supabase-js` (HTTP data APIs)

Use `@supabase/supabase-js` inside Edge Functions:
- DB queries go through Supabase's data API (PostgREST).
- RLS is enforced when you use the user's JWT.
- You can call Postgres Functions via RPC for transactions/locks.

Why this works well for Utter:
- easy to run in Deno
- avoids connection pooling pitfalls
- pairs naturally with RLS

### B) Direct Postgres connections (only when you truly need it)

Supabase documents direct Postgres connections from Edge Functions and calls out:
- pooler mode differences (transaction vs session)
- prepared statement pitfalls with some clients under transaction pooling

We should only go direct when we need:
- multi-statement transactions that are awkward via RPC, or
- row locks (`SELECT ... FOR UPDATE`) outside a stored procedure

If we go direct, follow the official "connect to Postgres" guide exactly.

## Storage: uploading large audio files (do not proxy through Edge)

Utter allows up to 50MB reference uploads.

Edge Functions are not the right place to stream large bodies. Instead:
- upload audio directly to Supabase Storage
- use either:
  - signed upload URLs (Edge authorizes the path, browser uploads), or
  - resumable uploads (TUS) for reliability (recommended by Supabase for larger files)

Signed upload URLs are a good fit for our "stable API" goal:
1) client asks Edge API for an upload URL + object key
2) client uploads to Storage with that signed URL
3) client calls Edge API to finalize (create `voice` row, start transcription, etc.)

Supabase Storage client primitives (JS reference):
```ts
const { data, error } = await supabase.storage
  .from("references")
  .createSignedUploadUrl("<user_id>/<voice_id>/reference.wav");
```

## CORS (browser access)

Edge Functions must handle CORS explicitly:
- respond to `OPTIONS` preflight
- include `Access-Control-Allow-*` headers on all responses

Supabase documents a small CORS helper (`corsHeaders`) in the HTTP methods guide. Use that pattern rather than hand-rolling headers in every handler.

## Secrets and environment variables (Edge Functions)

Supabase provides built-in env vars in Edge Functions (project URL + keys) and supports setting additional secrets.

Key rules from the docs:
- You cannot set env vars prefixed `SUPABASE_` (reserved).
- Do not commit `.env` files; use `supabase secrets set ...` for deployed environments.
- Use function configuration (`supabase/config.toml`) for `verify_jwt` and other settings.

For Utter we need secrets for:
- Modal endpoints (submit/status/result/cancel)
- Mistral (Voxtral) API keys (if we keep transcription server-side)
- Stripe keys (later)

## CLI workflow (the minimum we should standardize)

### Local stack

Initialize:
```bash
supabase init
```

Start local stack:
```bash
supabase start
```

### Migrations (local -> staging -> prod)

Suggested workflow (from Supabase docs):
- make schema changes locally
- generate a migration file
- reset locally to verify migrations are complete
- push to staging
- promote to prod

Commands we should expect to use frequently:
```bash
supabase db diff -f <migration_name>
supabase db reset
supabase db push
```

### Edge Functions

Create + serve locally:
```bash
supabase functions new api
supabase functions serve api
```

Deploy:
```bash
supabase link --project-ref <ref>
supabase functions deploy api
```

Set secrets:
```bash
supabase secrets set MODAL_JOB_SUBMIT=...
supabase secrets set MISTRAL_API_KEY=...
```

## Environments (dev / staging / prod)

Supabase recommends separating environments into distinct projects.

For Utter this implies:
- one Supabase project per environment
- migrations in git, promoted via CI
- secrets set per environment (not shared)

## Next actions (what to do in this repo)

- Full architecture reference: [`architecture.md`](./architecture.md)
- Edge API surface + routing strategy: [`backend.md`](./backend.md)
- Schema + RLS + storage policies: [`database.md`](./database.md)
- Timeline: [`milestone.md`](./milestone.md)
