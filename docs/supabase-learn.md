# Supabase — A Learning Guide (for this project)

This document explains what Supabase is, how it runs locally on your machine, what all the pieces do, and how it eventually gets deployed to a real cloud project. Written for someone who's never used Supabase before, grounded in this project's actual setup.

---

## What is Supabase?

Supabase is an open-source backend platform. Think of it as "Firebase but with Postgres." Instead of building your own backend server, Supabase gives you:

- **A Postgres database** — real SQL, not a document store
- **Authentication** — sign-up, sign-in, JWTs, OAuth, magic links
- **Storage** — file uploads with access control (like S3 but simpler)
- **Edge Functions** — serverless API endpoints (like AWS Lambda, but using Deno/TypeScript)
- **PostgREST** — auto-generated REST API from your database tables
- **Realtime** — WebSocket subscriptions for live data updates
- **Studio** — a web-based dashboard to manage everything

The key idea: you define your database schema (tables, policies), write edge functions for custom logic, and Supabase handles auth, storage, and API routing. Your frontend talks directly to Supabase.

---

## How Utter uses Supabase

Before Supabase, Utter had a Python FastAPI backend with SQLite. The migration replaces that with:

| Old (FastAPI) | New (Supabase) |
|---------------|----------------|
| SQLite database | **Postgres** (with Row Level Security) |
| FastAPI routes in `backend/main.py` | **Edge Functions** in `supabase/functions/api/` |
| Custom auth with password hashing | **Supabase Auth** (handles everything) |
| Local file storage | **Supabase Storage** (private buckets with signed URLs) |
| Background thread polling Modal.com | **On-demand polling** per frontend request |

The frontend (React) now uses the `@supabase/supabase-js` client library to handle auth sessions, and calls edge functions for all API operations.

---

## The local development stack

When you run Supabase locally, the CLI spins up **real Supabase services inside Docker containers**. It's not a mock or simulator — it's the actual Supabase software running on your machine.

### What Docker containers are running

Right now, `docker ps` shows these containers for the `utter` project:

| Container | What it does | Port |
|-----------|-------------|------|
| `supabase_db_utter` | **PostgreSQL 15** — the actual database | `localhost:54322` |
| `supabase_kong_utter` | **API Gateway** — routes all requests | `localhost:54321` |
| `supabase_auth_utter` | **GoTrue** — handles auth (sign-up, sign-in, JWTs) | internal |
| `supabase_storage_utter` | **Storage API** — file uploads and signed URLs | internal |
| `supabase_rest_utter` | **PostgREST** — auto-REST API from DB tables | internal |
| `supabase_studio_utter` | **Studio** — web dashboard UI | `localhost:54323` |
| `supabase_realtime_utter` | **Realtime** — WebSocket server | internal |
| `supabase_edge_runtime_utter` | **Deno runtime** — runs edge functions | internal |
| `supabase_inbucket_utter` | **Email testing** — catches auth emails locally | `localhost:54324` |
| `supabase_pg_meta_utter` | **Postgres Meta** — table introspection for Studio | internal |
| `supabase_imgproxy_utter` | **Image proxy** — image transformations for Storage | internal |

All the "internal" services are accessible through the API gateway at `localhost:54321`. You never talk to them directly — Kong routes everything.

### How requests flow

```
Browser (localhost:5173)
    │
    ▼
API Gateway — Kong (localhost:54321)
    │
    ├── /functions/v1/api/*  →  Edge Runtime (Deno) → your TypeScript code
    ├── /auth/v1/*           →  GoTrue (auth service)
    ├── /storage/v1/*        →  Storage API
    ├── /rest/v1/*           →  PostgREST (auto-generated from tables)
    └── /realtime/v1/*       →  Realtime (WebSockets)
```

When the frontend calls `POST /functions/v1/api/generate`, Kong routes it to the Deno edge runtime, which runs `supabase/functions/api/routes/generate.ts`. That function uses the Supabase client (server-side) to insert rows into Postgres and upload files to Storage.

---

## How to start and stop the local stack

### NPM scripts (defined in root `package.json`)

```bash
npm run sb:start    # Start all Docker containers + apply migrations
npm run sb:stop     # Stop all containers (data persists)
npm run sb:serve    # Start edge functions with hot reload
npm run sb:reset    # Drop database and re-run all migrations + seed
npm run sb:status   # Show all service URLs and keys
```

### Typical development workflow

```bash
# Terminal 1 — Start Supabase (one-time, stays running)
npm run sb:start

# Terminal 2 — Edge functions (restart when you change function code)
npm run sb:serve

# Terminal 3 — Frontend
npm --prefix frontend run dev
```

Then open:
- **http://localhost:5173** — your app
- **http://localhost:54323** — Supabase Studio (database viewer)
- **http://localhost:54324** — Inbucket (email testing)

### Data persistence

- `sb:start` / `sb:stop` — data **persists** between stops. Your test users, voices, and generations survive restarts.
- `sb:reset` — **destroys everything** and rebuilds from migrations + seed. Use this for a clean slate.
- Docker volumes hold the data. If you run `docker volume prune`, you lose everything.

---

## Supabase Studio — your local dashboard

Open **http://localhost:54323** in your browser. This is the same dashboard you'd see on `supabase.com/dashboard` for a cloud project, but running locally.

### What you can do in Studio

**Table Editor** (left sidebar → Table Editor)
- See all tables: `profiles`, `voices`, `generations`, `tasks`
- Browse rows — you'll see the test data from our Phase 08 tests
- Insert, edit, or delete rows manually
- See column types, constraints, and relationships

**Authentication** (left sidebar → Authentication)
- See all registered users (e.g., `usera_08@test.com`, `userb_08@test.com`)
- See when they signed up, last sign-in, email confirmation status
- Create or delete users manually

**Storage** (left sidebar → Storage)
- Browse the `references` bucket (voice audio files)
- Browse the `generations` bucket (generated speech files)
- See files organized by `{user_id}/{voice_id}/reference.wav`
- Upload or delete files manually

**SQL Editor** (left sidebar → SQL Editor)
- Run any SQL query against the local Postgres
- Useful for debugging: `SELECT * FROM voices WHERE user_id = '...'`
- Can test RLS: `SET ROLE authenticated; SET request.jwt.claims = '...'; SELECT ...`

**Database** (left sidebar → Database)
- See all tables, views, functions, triggers, and extensions
- Inspect RLS policies visually

---

## The project file structure

```
supabase/
├── config.toml                      # Project config (ports, auth settings, etc.)
├── .env.local                       # Secrets (Modal API keys) — NOT in git
├── seed.sql                         # Seed data (run on db reset)
├── migrations/
│   ├── 20260207190731_initial_schema.sql   # Tables, RLS, storage buckets
│   └── 20260207195500_task_poll_count.sql  # Added poll count function
└── functions/
    ├── _shared/                     # Shared utilities
    │   ├── auth.ts                  # requireUser() — validates JWT
    │   ├── cors.ts                  # CORS headers
    │   ├── modal.ts                 # Modal.com API client
    │   └── supabase.ts             # createUserClient() / createAdminClient()
    └── api/
        ├── index.ts                 # Hono router — entry point
        └── routes/
            ├── me.ts                # GET /me, PATCH /profile
            ├── clone.ts             # POST /clone/upload-url, /clone/finalize
            ├── voices.ts            # GET /voices, GET /voices/:id/preview, DELETE
            ├── generate.ts          # POST /generate (submits to Modal)
            ├── generations.ts       # GET /generations, audio, DELETE
            ├── design.ts            # POST /voices/design/preview, /voices/design
            ├── tasks.ts             # GET /tasks/:id (polls Modal), DELETE, cancel
            └── languages.ts         # GET /languages (public)
```

### Key files explained

**`config.toml`** — Controls everything about the local stack:
- `project_id = "utter"` — names the Docker containers
- `[auth] enable_confirmations = false` — sign-ups are instant (no email verification in dev)
- `[auth] jwt_expiry = 3600` — tokens last 1 hour
- `[storage] file_size_limit = "50MiB"` — max upload size
- `[edge_runtime] policy = "oneshot"` — hot reload for edge functions
- `[functions.api] verify_jwt = false` — the function handles JWT validation itself

**`migrations/*.sql`** — Database schema changes, applied in order. These create tables, RLS policies, storage buckets, and grant/revoke permissions. When you run `sb:start`, all migrations run automatically.

**`.env.local`** — Secrets that edge functions need at runtime (Modal API endpoints and keys). This file is in `.gitignore` — it never gets committed.

---

## Key concepts

### Row Level Security (RLS)

RLS is Postgres's built-in access control at the row level. Every table has policies that define who can see/modify which rows.

Example from this project:
```sql
-- Users can only see their own voices
CREATE POLICY "Users can view own voices"
  ON voices FOR SELECT
  USING (auth.uid() = user_id);
```

This means: when a user queries the `voices` table, Postgres automatically filters to only show rows where `user_id` matches their JWT. Even if someone crafts a malicious query, they can't see other users' data. The database enforces it, not the application code.

Every table in Utter has RLS enabled:
- `profiles` — SELECT/UPDATE own row only
- `voices` — SELECT/INSERT/DELETE own rows only
- `generations` — SELECT/DELETE own rows only
- `tasks` — SELECT own rows only

### Grant revocations (defense in depth)

On top of RLS, we also revoked certain SQL grants. Even if a user is authenticated, they can't:
- INSERT into `tasks` or `generations` directly (only edge functions can, using the service role)
- UPDATE `voices` directly (renames go through an edge function)

This means PostgREST (the auto-REST API) can't be abused to create fake tasks or generations. Only edge functions with the `service_role` key can write to these tables.

### Two types of Supabase clients

Edge functions create two types of clients:

```typescript
// User client — inherits the user's JWT, subject to RLS
const supabase = createUserClient(request)
// Can only see/modify the authenticated user's data

// Admin client — uses service_role key, bypasses RLS
const admin = createAdminClient()
// Can read/write anything — used for cross-user operations
```

The user client is used for reads (so RLS filters automatically). The admin client is used for writes that the user shouldn't do directly (creating tasks, uploading to storage).

### Signed URLs

Storage buckets in Utter are **private** — no public access. To let a user play their audio:

1. User requests `GET /generations/:id/audio`
2. Edge function verifies ownership (RLS)
3. Edge function creates a **signed URL** — a temporary link that expires in 1 hour
4. Returns a `302 redirect` to the signed URL
5. Browser follows redirect and gets the audio bytes

This way, audio files are never publicly accessible. Each play request generates a fresh signed URL.

### JWT and authentication flow

1. User signs in → Supabase Auth returns an `access_token` (JWT) + `refresh_token`
2. Frontend stores these in localStorage (handled by `@supabase/supabase-js`)
3. Every API call includes `Authorization: Bearer <access_token>`
4. Edge functions call `supabase.auth.getUser()` to validate the JWT and get the user ID
5. Token expires after 1 hour → client auto-refreshes using the refresh token

The anon key (`apikey` header) identifies the project. The access token identifies the user. Both are needed for authenticated requests.

---

## How testing works locally

### CLI testing (what we did in Phase 08)

Since the local stack exposes the same REST API, we can test everything with `curl`:

```bash
# Sign in and get a token
TOKEN=$(curl -s -X POST http://127.0.0.1:54321/auth/v1/token?grant_type=password \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"usera@test.com","password":"password123"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Make authenticated API calls
curl -s http://127.0.0.1:54321/functions/v1/api/voices \
  -H "Authorization: Bearer $TOKEN" \
  -H "apikey: $ANON_KEY"
```

This is exactly what the frontend does, just from the command line. Our Phase 08 test scripts (`scripts/phase08-test.sh` and `scripts/phase08-modal-e2e.sh`) automate this:

- **phase08-test.sh** — 29 tests: auth, CRUD, RLS isolation, PostgREST hardening, CORS, security
- **phase08-modal-e2e.sh** — 22 tests: full generation pipeline through real Modal.com (submit → poll → finalize → audio retrieval → cancel → delete)

### Browser testing

Some things can only be verified in a browser:
- WaveSurfer waveform rendering (canvas-based audio visualization)
- Audio playback through `<audio>` elements
- Console errors (React rendering issues)
- Network tab inspection (headers, redirects)

For these, open `http://localhost:5173` and test manually.

### Database inspection during testing

While tests run, you can watch the data change in real time:
1. Open **http://localhost:54323** (Studio)
2. Go to Table Editor → select `tasks` or `generations`
3. Run a test that creates data
4. Hit refresh in Studio → see the new rows appear
5. Watch `status` change from `pending` → `processing` → `completed`

You can also run SQL directly:
```sql
-- See all generations with their voice names
SELECT g.id, g.status, g.text, v.name as voice_name, g.created_at
FROM generations g
JOIN voices v ON g.voice_id = v.id
ORDER BY g.created_at DESC;
```

---

## How deployment to cloud works

Going from local to cloud is Phase 09 in the migration plan. Here's what changes and what stays the same.

### What stays exactly the same

- **Migration SQL files** — same tables, same RLS policies, same grants
- **Edge function code** — same TypeScript, same routes, same logic
- **Frontend code** — same React components, same API calls

### What changes

| Aspect | Local | Cloud |
|--------|-------|-------|
| API URL | `http://127.0.0.1:54321` | `https://<ref>.supabase.co` |
| Database | Docker container on your machine | Managed Postgres in AWS |
| Auth | Local GoTrue container | Supabase Auth cloud service |
| Storage | Local filesystem in Docker volume | S3-backed cloud storage |
| Edge Functions | Deno process on your machine | Deno Deploy (globally distributed) |
| Dashboard | `http://localhost:54323` | `https://supabase.com/dashboard` |
| Secrets (`.env.local`) | File on disk | Dashboard → Edge Functions → Secrets |
| Keys (anon, service_role) | Standard dev keys (same for everyone) | Unique per project (actual secrets) |

### Deployment commands

```bash
# 1. Create a project on supabase.com and get the project ref

# 2. Link your local project to the cloud project
supabase link --project-ref <your-project-ref>

# 3. Push migrations (creates all tables, RLS, etc. in cloud Postgres)
supabase db push

# 4. Deploy edge functions
supabase functions deploy api

# 5. Set secrets (env vars for edge functions)
supabase secrets set \
  MODAL_JOB_SUBMIT=https://... \
  MODAL_JOB_STATUS=https://... \
  MODAL_JOB_RESULT=https://... \
  MODAL_JOB_CANCEL=https://... \
  MODAL_ENDPOINT_VOICE_DESIGN=https://...

# 6. Update frontend env to point at cloud
# In frontend/.env:
#   VITE_SUPABASE_URL=https://<ref>.supabase.co
#   VITE_SUPABASE_ANON_KEY=<your-cloud-anon-key>

# 7. Deploy frontend to Vercel (or wherever)
```

After this, the app works identically — just against cloud infrastructure instead of Docker containers.

### Cloud dashboard

The online Supabase dashboard at `supabase.com/dashboard` has all the same features as local Studio plus:
- **Usage metrics** — API calls, storage size, bandwidth
- **Logs** — edge function invocations with request/response details
- **Backups** — automatic daily database backups
- **Branching** — preview environments for database changes (like Vercel previews)
- **Connection pooling** — PgBouncer for production workloads
- **Custom domains** — use your own domain for the API

---

## Mental model: how it all connects

```
┌──────────────────────────────────────────────────────────────┐
│  YOUR MACHINE (local dev)                                    │
│                                                              │
│  ┌─────────────┐    ┌────────────────────────────────────┐  │
│  │  Frontend    │    │  Supabase (Docker)                 │  │
│  │  React+Vite  │───▶│                                    │  │
│  │  :5173       │    │  Kong Gateway (:54321)             │  │
│  └─────────────┘    │    ├── Auth (GoTrue)               │  │
│                      │    ├── Storage (S3-compatible)     │  │
│                      │    ├── PostgREST (auto-REST)       │  │
│                      │    └── Edge Functions (Deno)       │  │
│                      │         └── Your API code          │  │
│                      │              └── Talks to Modal.com│──┼──▶ Modal.com (GPU)
│                      │                                    │  │
│                      │  Postgres (:54322)                 │  │
│                      │    ├── profiles, voices, etc.      │  │
│                      │    └── RLS policies enforce access │  │
│                      │                                    │  │
│                      │  Studio (:54323)                   │  │
│                      │    └── Web UI to manage everything │  │
│                      └────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘

                              │
                    Deploy (supabase db push +
                     supabase functions deploy)
                              │
                              ▼

┌──────────────────────────────────────────────────────────────┐
│  CLOUD (production)                                          │
│                                                              │
│  ┌─────────────┐    ┌────────────────────────────────────┐  │
│  │  Frontend    │    │  Supabase Cloud                    │  │
│  │  Vercel      │───▶│  https://<ref>.supabase.co         │  │
│  │  vercel.app  │    │    ├── Same Auth                   │  │
│  └─────────────┘    │    ├── Same Storage (now on S3)    │  │
│                      │    ├── Same PostgREST              │  │
│                      │    └── Same Edge Functions         │  │
│                      │         └── Same API code          │──┼──▶ Modal.com (GPU)
│                      │                                    │  │
│                      │  Managed Postgres (AWS)            │  │
│                      │    ├── Same tables + RLS           │  │
│                      │    └── Backups, monitoring, etc.   │  │
│                      │                                    │  │
│                      │  Dashboard (supabase.com)          │  │
│                      │    └── Same as Studio but online   │  │
│                      └────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

The entire point of Supabase's local dev story is: **what works on localhost works in production**. Same schema, same functions, same policies. The deployment is mechanical, not architectural.

---

## Quick reference

| Task | Command / URL |
|------|--------------|
| Start Supabase | `npm run sb:start` |
| Start edge functions | `npm run sb:serve` |
| Start frontend | `npm --prefix frontend run dev` |
| View database | http://localhost:54323 (Studio) |
| View emails | http://localhost:54324 (Inbucket) |
| API base URL | `http://127.0.0.1:54321/functions/v1/api/` |
| Direct Postgres | `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Clean slate | `npm run sb:reset` |
| Stop everything | `npm run sb:stop` |
| Run QA tests | `bash scripts/phase08-test.sh` |
| Run Modal E2E | `bash scripts/phase08-modal-e2e.sh` |
