# Supabase Backend Architecture

> Architectural validation for migrating Utter from FastAPI + SQLite to Supabase (Postgres + Edge Functions + Auth + Storage). Written Feb 2026.

---

## 1. Request Flow Mapping

### Frontend hosting (production)

- Frontend is a **React + Vite SPA** hosted on **Vercel**.
- Browser HTTP calls to our backend contract remain `https://<app-domain>/api/*` and are implemented via **Vercel rewrites** to Supabase Edge Functions (`/functions/v1/api/*`).
- Avoid WebSockets through Vercel rewrites. For the initial Option A stack, prefer HTTP polling (or an `/api/*` push mechanism like SSE). Treat Supabase Realtime / direct WebSockets as future opt-ins with explicit security review.

See `docs/vercel-frontend.md` and `docs/supabase-security.md`.

### How requests travel

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React SPA)                  │
│  supabase-js client initialized w/ project URL + anon   │
└──────┬──────────────┬──────────────┬────────────────────┘
       │              │              │
       ▼              ▼              ▼
  Edge Functions   PostgREST      Realtime
  (custom logic)   (auto CRUD)   (subscriptions)
       │              │              │
       ▼              ▼              ▼
┌──────────────────────────────────────────────────────────┐
│                   SUPABASE PLATFORM                      │
│  ┌─────────────┐  ┌───────────┐  ┌───────────────────┐  │
│  │ Edge Fn     │  │ PostgREST │  │ Realtime Server   │  │
│  │ (Deno)      │  │ (auto API)│  │ (WebSocket)       │  │
│  └──────┬──────┘  └─────┬─────┘  └────────┬──────────┘  │
│         │               │                  │             │
│         ▼               ▼                  ▼             │
│  ┌───────────────────────────────────────────────────┐   │
│  │              PostgreSQL + RLS                      │   │
│  │  Supavisor (transaction mode pooler, port 6543)   │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  Supabase    │  │  Supabase    │  │  Supabase    │   │
│  │  Auth        │  │  Storage     │  │  Secrets     │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### Request paths (Option A: API-only frontend)

Decision: the deployed SPA does **not** call PostgREST or Supabase Realtime directly for app data. The browser uses Supabase Auth SDK for session management, and calls `fetch('/api/*')` for all app data (Vercel rewrite to the Supabase `api` Edge Function). PostgREST and Realtime still exist and must be secured, but they are not part of the frontend integration contract.

**1. Frontend → Edge Function** (all app data)
```
fetch('/api/generate', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify({ ... }),
})
  → Vercel rewrite to https://<ref>.supabase.co/functions/v1/api/generate
  → JWT fetched via supabase-js Auth and attached as Authorization header
  → Edge fn validates JWT, queries DB, calls Modal, returns JSON
```
Use for: all Utter app data (voices, generations, tasks, billing, Modal orchestration, Storage signing).

**2. Edge Function → PostgREST** (internal data plane)
```
supabase.from('voices').select('*').eq('user_id', userId)
  → HTTPS GET to https://<ref>.supabase.co/rest/v1/voices?user_id=eq.<id>
  → JWT in Authorization header → RLS enforces row-level access
  → Returns rows the user owns
```
Use for: internal reads/writes from Edge Functions. In Option A, the SPA does not call PostgREST directly.

**3. Supabase Realtime** (future; optional)
```
supabase.channel('tasks').on('postgres_changes', {
  event: 'UPDATE', schema: 'public', table: 'tasks',
  filter: `user_id=eq.${userId}`
}, callback).subscribe()
```
Use for: potential future push updates. Not part of the initial Option A frontend contract; if adopted later, treat it as a direct Supabase surface area that must be secured like PostgREST (RLS, grants, exposed tables).

### Decision matrix: when to use what

| Scenario | Use | Why |
|----------|-----|-----|
| List user's voices | Edge Function | Single stable contract (`/api/*`), hides PostgREST from the frontend |
| Delete a voice | Edge Function | Must also delete from Storage; server-side invariant |
| Submit generation job | Edge Function | Needs Modal API call, task creation, validation |
| Poll task status | Edge Function | Performs one Modal status check + idempotent finalize |
| Upload reference audio | Edge Function | Returns signed upload URL; server controls object keys |
| Clone a voice | Edge Function | Multi-step: validate audio → store → create DB row |
| Design voice preview | Edge Function | Calls Modal VoiceDesign API |
| Get generation audio | Storage signed URL | Edge returns signed URL or 302 redirect |
| User sign-in/out | Supabase Auth SDK | Built-in, no custom code |
| Read/update user profile | Edge Function | Prevents direct client writes to billing/credits fields |

---

## 2. Edge Functions as Backend API

### Function structure: monolithic router

One "fat function" named `api` that handles all routes via Hono (or URL Pattern API). This is the recommended Supabase pattern — fewer functions = fewer cold starts + simpler deployment.

```
supabase/functions/
  _shared/
    cors.ts           # CORS headers
    supabase.ts       # Client initialization helpers
    modal.ts          # Modal.com HTTP client
    validation.ts     # Input validation helpers
  api/
    index.ts          # Entry point — Hono router
```

Routes inside the `api` function (all prefixed `/api/`):

```typescript
import { Hono } from 'npm:hono@4'
import { corsHeaders } from '../_shared/cors.ts'

const app = new Hono().basePath('/api')

// Voices
app.get('/voices', listVoices)
app.delete('/voices/:id', deleteVoice)
app.get('/voices/:id/preview', voicePreview)

// Clone
app.post('/clone', cloneVoice)

// Generate
app.post('/generate', submitGeneration)

// Design
app.post('/voices/design/preview', designPreview)
app.post('/voices/design', saveDesignedVoice)

// Tasks
app.get('/tasks/:id', getTask)
app.post('/tasks/:id/cancel', cancelTask)

// Generations
app.get('/generations', listGenerations)
app.delete('/generations/:id', deleteGeneration)
app.post('/generations/:id/regenerate', regenerate)

// Languages
app.get('/languages', getLanguages)

// Transcription
app.post('/transcriptions', batchTranscribe)

Deno.serve(app.fetch)
```

**Why one function, not many:** Each function has its own cold start. With 15+ endpoints, that's 15+ potential cold starts. One function = one cold start, warm for all routes.

**Path prefix rule:** Supabase requires all routes prefixed with the function name. So `api` function → `/api/voices`, `/api/generate`, etc. This maps 1:1 with our current `/api/` prefix.

### Connecting to Postgres

Two patterns, use both:

**Pattern A: Service role client (admin operations)**
```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)
// Bypasses RLS — use for system operations (task updates, storage writes)
```

**Pattern B: User-scoped client (respects RLS)**
```typescript
const supabaseUser = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
  { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
)
// Uses caller's JWT — RLS enforces row-level access
```

Use Pattern A for: task management, storage operations initiated by backend, cross-user queries.
Use Pattern B for: reading/writing user-owned data where RLS should apply.

Connection goes through Supavisor transaction mode pooler (port 6543). Edge functions are pre-configured for this — no manual connection string needed when using supabase-js.

### Auth flow: JWT propagation

```
Frontend (logged in user)
  → fetch('/api/*', with Authorization: Bearer <user-jwt>)
  → Vercel rewrites /api/* to https://<ref>.supabase.co/functions/v1/api/*
  → Edge Function receives request
  → Extracts token: req.headers.get('Authorization')
  → Option 1: supabase.auth.getUser(token) → full user object
  → Option 2: Pass JWT to user-scoped client → RLS handles it
  → Option 3: supabase.auth.getClaims(token) → JWT claims only
```

JWT is verified by the edge gateway before your function code runs (when `verify_jwt = true` in config.toml). You don't need to manually verify the signature — gateway handles that.

### CORS handling

Must be manual. Every edge function must handle OPTIONS preflight.

```typescript
// supabase/functions/_shared/cors.ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://utter.app', // production domain
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
  'Access-Control-Max-Age': '86400',
}
```

**Critical:** OPTIONS handler must be at the TOP of the function, before any code that might throw. If an import fails or a validation runs before the OPTIONS check, CORS preflight will fail.

### Shared code

`supabase/functions/_shared/` directory. Import with relative paths:
```typescript
import { corsHeaders } from '../_shared/cors.ts'
import { createUserClient } from '../_shared/supabase.ts'
```

This is where Modal HTTP client code, validation logic, and utility functions live. Shared across all functions.

### Limitations

| Constraint | Value | Impact on Utter |
|-----------|-------|-----------------|
| CPU time | 200ms per invocation | Fine for API orchestration. NOT fine for audio processing — must stay on Modal |
| Wall clock | 400s | Plenty for Modal job submission + a single status check. Don't poll in-function — use DB + repeated short requests (polling or SSE) instead |
| Bundle size | 20MB | Should be fine — we're not bundling audio files |
| Memory | Plan-dependent | Large audio file buffering could be an issue. Stream instead of buffer |
| Idle timeout | 150s | If no response in 150s → 504. Don't do long-running sync work |
| Stateless | No persistent memory | Task state must be in DB, not in-memory (already planned) |
| Deno runtime | Not Node.js | Most npm packages work via `npm:` prefix, but some Node-specific packages may not |
| No HTML serving | GET text/html → text/plain | Not a problem — we're serving JSON API responses |

### Cold starts

Edge functions use ESZip bundles for fast cold starts (milliseconds). Isolates stay warm for plan-dependent duration. With the "fat function" pattern (one `api` function), cold start only happens once — subsequent requests hit the warm isolate.

Mitigation: keep function bundle small, avoid heavy imports. If cold starts are a problem in practice, Supabase offers persistent storage mounting for up to 97% faster cold starts.

---

## 3. Database Layer

### Schema design

```sql
-- Users come from Supabase Auth (auth.users table).
-- We also maintain a public.profiles table for app-specific user metadata (billing, display name, etc.).

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique,
  display_name text,
  avatar_url text,
  subscription_tier text not null default 'free',
  credits_remaining int not null default 100,
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.voices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  reference_path text,                    -- storage path: references/{user_id}/{voice_id}.ext
  reference_transcript text,
  language text not null default 'Auto',
  source text not null check (source in ('uploaded', 'designed')),
  description text,
  created_at timestamptz not null default now()
);

create table public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  voice_id uuid references public.voices(id) on delete set null,
  text text not null,
  audio_path text,                        -- storage path: generations/{user_id}/{gen_id}.wav
  duration_seconds float,
  language text not null default 'Auto',
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  generation_time_seconds float,
  error_message text,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('generate', 'design', 'clone')),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  metadata jsonb default '{}',            -- modal_job_id, voice_id, generation_id, text_length
  result jsonb,                           -- audio_path, duration, etc.
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Indexes for RLS performance (critical — without these, RLS policy checks do full table scans)
create index idx_profiles_id on public.profiles(id);
create index idx_voices_user_id on public.voices(user_id);
create index idx_generations_user_id on public.generations(user_id);
create index idx_tasks_user_id on public.tasks(user_id);
create index idx_generations_voice_id on public.generations(voice_id);
create index idx_tasks_status on public.tasks(status) where status in ('pending', 'processing');
```

Key changes from current SQLite schema:
- Added `user_id` on every table (multi-tenant)
- `tasks` table replaces in-memory TaskStore (durable, survives restarts)
- `audio_path` stores Supabase Storage paths instead of local filesystem paths

### RLS policies

RLS-first design. Every table gets RLS enabled + per-operation policies.

```sql
-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.voices enable row level security;
alter table public.generations enable row level security;
alter table public.tasks enable row level security;

-- Profiles: users read their own; updates are restricted (see note below)
create policy "profiles_select" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Voices: users CRUD their own
create policy "voices_select" on public.voices
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "voices_insert" on public.voices
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "voices_delete" on public.voices
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Generations: users read/delete their own
create policy "generations_select" on public.generations
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "generations_delete" on public.generations
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Tasks: users read their own
create policy "tasks_select" on public.tasks
  for select to authenticated
  using ((select auth.uid()) = user_id);
```

**Performance note:** Wrapping `auth.uid()` in `(select auth.uid())` triggers an `initPlan` optimization — Postgres evaluates it once per statement instead of once per row. This matters on tables with many rows.

**Column-level protection note:** RLS only restricts which rows a user can update, not which columns. For tables where clients can UPDATE rows (e.g. `profiles`, and `voices` if we add client-side rename), use one of:

- Postgres column privileges (`GRANT UPDATE (display_name, avatar_url) ...`) and revoke broad UPDATE, and/or
- a `BEFORE UPDATE` trigger that rejects changes to protected columns

See `docs/supabase-security.md`.

**INSERT/UPDATE on generations and tasks:** Done by edge functions using service role key (bypasses RLS). Users don't directly insert generations or tasks — edge functions do it on their behalf after validation.

### RLS + edge functions interaction

| Caller | Key Used | RLS Applied? | Use Case |
|--------|----------|-------------|----------|
| Frontend → Edge Function (`/api/*`) | user JWT | N/A (Edge enforces) | All app data via stable API-only contract |
| Edge fn → supabase-js (anon key + user JWT) | User-scoped | Yes | User reads within edge fn |
| Edge fn → supabase-js (service role key) | Admin | **No** | Task creation, storage writes, cross-user ops |

**When to use service role bypass:** When the edge function needs to write data on behalf of the user (task creation, generation record creation, audio storage) after validating the request itself. The edge fn IS the authorization layer for writes — it validates the user's JWT, checks permissions, then writes with service role.

### DB functions vs edge functions

| Use DB functions (plpgsql) | Use Edge Functions |
|---|---|
| Complex queries that benefit from being close to data | External API calls (Modal, Mistral) |
| Triggers (auto-update `updated_at`) | Multi-step workflows (validate → store → submit job) |
| Computed columns | File processing |
| Aggregations used by multiple clients | Anything needing npm packages |

For Utter, most logic belongs in edge functions because it involves external service calls (Modal, Mistral). DB functions make sense for:
- `updated_at` trigger on tasks table
- Possibly a function to clean up expired tasks (`pg_cron` + plpgsql)

### Migration workflow

```
Local development:
  supabase init → supabase start → make schema changes → supabase db diff -f <name>

Testing:
  supabase db reset (replays all migrations + seed.sql)

Deploy to staging:
  supabase link --project-ref <staging-ref>
  supabase db push --dry-run (preview)
  supabase db push

Deploy to production:
  Via CI/CD (GitHub Actions) — never push to prod from local machine
```

Migration files live in `supabase/migrations/` as timestamped SQL files. Tracked in `supabase_migrations.schema_migrations` table.

**Gotcha:** `supabase db diff` uses a shadow database internally and has known failure cases with some schema changes. Always verify with `supabase db reset` before pushing.

---

## 4. Auth Architecture

### Supabase Auth as sole provider

No custom auth. Use Supabase Auth directly.

```
Sign up → supabase.auth.signUp({ email, password })
Sign in → supabase.auth.signInWithPassword({ email, password })
Sign out → supabase.auth.signOut()
OAuth → supabase.auth.signInWithOAuth({ provider: 'google' })
```

### JWT flow

```
1. User signs in via supabase.auth.signInWithPassword()
2. Supabase Auth returns:
   - access_token (JWT, ~1hr expiry, configurable)
   - refresh_token (long-lived, single-use, auto-rotated)
3. supabase-js stores tokens, auto-refreshes before expiry
4. Every supabase-js call attaches: Authorization: Bearer <access_token>
5. PostgREST / Edge Functions / Storage all receive the JWT
6. JWT payload contains:
   - sub: user UUID (= auth.uid())
   - role: "authenticated"
   - email, aal, session_id, app_metadata, user_metadata
```

### How RLS uses JWT claims

```sql
-- auth.uid() returns JWT sub claim as uuid
-- equivalent to: (auth.jwt()->>'sub')::uuid
create policy "own_data" on voices
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- auth.jwt() returns full payload as jsonb
-- use for role-based access:
create policy "admin_only" on admin_data
  for all to authenticated
  using (auth.jwt()->'app_metadata'->>'role' = 'admin');
```

**Security note:** Don't use `user_metadata` in RLS policies — authenticated users can modify their own `raw_user_meta_data`. Use `app_metadata` (only modifiable server-side).

### Service role key in edge functions

```typescript
// Service role bypasses ALL RLS — full database access
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)
```

**When to use:** Task management, storage writes, admin operations, cross-user queries. Never expose to client.

**When NOT to use:** Simple user-scoped reads. Use the user's JWT + RLS instead.

### Securing edge functions

JWT verification is on by default. The edge gateway validates the JWT signature before your function code runs. To disable (e.g., for webhooks):

```toml
# supabase/config.toml
[functions.stripe-webhook]
verify_jwt = false
```

For our `api` function, keep `verify_jwt = true`. All requests must be authenticated.

---

## 5. API Inventory & Feasibility Check

### Current endpoints → Supabase mapping

| Current Endpoint | Method | Current Behavior | Supabase Approach | Notes |
|---|---|---|---|---|
| `GET /api/voices` | GET | List voices, pagination, search | **Edge Function** | API-only frontend: Edge reads from DB and returns results |
| `POST /api/clone` | POST | Upload audio + create voice | **Edge Function** | Needs audio validation, storage write, transcription |
| `DELETE /api/voices/:id` | DELETE | Delete voice + audio file | **Edge Function** | Must also delete from Storage |
| `GET /api/voices/:id/preview` | GET | Serve audio file | **Storage signed URL** | Generate signed URL, redirect client |
| `POST /api/generate` | POST | Submit TTS job → Modal | **Edge Function** | Creates task + generation rows, submits Modal job |
| `GET /api/generations` | GET | List generations, pagination | **Edge Function** | API-only frontend: Edge reads from DB and returns results |
| `DELETE /api/generations/:id` | DELETE | Delete generation + audio | **Edge Function** | Must also delete from Storage |
| `POST /api/generations/:id/regenerate` | POST | Regenerate from an existing row | **Edge Function** | Server validates ownership + creates new task/generation |
| `GET /api/tasks/:id` | GET | Poll task status | **Edge Function** | Single-call status check + idempotent finalize |
| `POST /api/tasks/:id/cancel` | POST | Cancel Modal job | **Edge Function** | Must call Modal cancel API + update DB |
| `DELETE /api/tasks/:id` | DELETE | Clean up task | **Edge Function** | API-only frontend; Edge deletes task row after checks |
| `POST /api/voices/design/preview` | POST | Design voice via Modal | **Edge Function** | Calls Modal VoiceDesign API |
| `POST /api/voices/design` | POST | Save designed voice | **Edge Function** | Storage write + DB insert |
| `GET /api/languages` | GET | Return language list | **Edge Function or static** | Could be a static config; edge fn if dynamic |
| `POST /api/transcriptions` | POST | Batch transcribe audio | **Edge Function** | Proxies to Mistral API |
| `WS /api/transcriptions/realtime` | WebSocket | Stream transcription | **Edge Function (WebSocket)** | Edge functions support WebSocket servers |

### Flagged items needing special handling

**1. WebSocket transcription (`/api/transcriptions/realtime`)**
- **Status:** Feasible. Edge functions support WebSocket servers since late 2024.
- **Concern:** Wall clock limit of 400s. Long recording sessions could exceed this. Typical recording is 10s-5min, so 400s wall clock should be fine for most cases.
- **Alternative if needed:** Supabase Realtime Broadcast channel as a proxy layer, or direct Mistral WebSocket from frontend (if Mistral supports browser connections with API key security).
- **Verdict:** Edge Function WebSocket should work. Test with long recordings.

**2. Modal job polling (current: background thread polls every 5-10s)**
- **Status:** Cannot do long-running background polling in a single edge fn invocation (400s wall clock limit).
- **Solution:** Change the pattern. Instead of polling in the backend:
  - Edge fn submits Modal job, stores `modal_job_id` in tasks table, returns immediately
  - Frontend polls `GET /api/tasks/:id` (one status check per call) until terminal
  - A separate mechanism checks Modal status and updates the task row
  - Options for the "checker": (a) frontend polls an edge fn that does a single Modal status check, (b) `pg_cron` calls an edge fn periodically, (c) Modal webhook calls back to an edge fn on completion
- **Recommended:** Frontend polls a lightweight `/api/tasks/:id/check` edge fn that does ONE Modal status check per call. If Modal is done → finalize (upload audio to Storage, update task row). This is the simplest migration path from current polling pattern.
- **Verdict:** Works, but requires pattern change from background polling to on-demand check.

**3. Large file uploads (reference audio, up to 50MB)**
- **Status:** Edge function can receive multipart form data. 20MB bundle limit is for the function code, not request body.
- **Concern:** Edge fn memory limits during audio processing. Don't buffer entire file in memory — stream to Storage.
- **Verdict:** Feasible. Use Supabase Storage upload from edge fn with streaming.

**4. Audio file serving**
- **Status:** Don't serve audio through edge functions. Use Supabase Storage signed URLs.
- **Pattern:** Edge fn returns a signed URL (or 302 redirect) → frontend fetches directly from Storage CDN.
- **Verdict:** Better than current approach (faster, CDN-cached).

**5. Cron jobs (task cleanup, expired task deletion)**
- **Status:** Supabase supports `pg_cron` extension. Schedule a Postgres function to clean up old tasks.
- **Alternative:** `pg_cron` triggers an edge function via `net.http_post` for more complex cleanup.
- **Verdict:** Straightforward.

---

## 6. Frontend Integration Pattern

### Supabase client initialization

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

Single instance, imported everywhere. supabase-js handles auth token refresh, header attachment, retries.

### Calling edge functions vs direct queries

```typescript
// Direct table query inside Edge Function (goes through PostgREST + RLS)
const { data: voices } = await supabase
  .from('voices')
  .select('*')
  .order('created_at', { ascending: false })
  .range(0, 19)

// Edge function call (custom logic)
const { data, error } = await supabase.functions.invoke('api/generate', {
  body: { voice_id, text, language },
})

// Edge function with FormData (file upload)
const formData = new FormData()
formData.append('audio', file)
formData.append('name', name)
formData.append('transcript', transcript)
const { data, error } = await supabase.functions.invoke('api/clone', {
  body: formData, // Content-Type auto-detected
})
```

**Note on invoke path:** `supabase.functions.invoke('api/generate')` maps to `https://<ref>.supabase.co/functions/v1/api/generate`. The function name is `api`, the path `/generate` is handled by the Hono router inside.

### Auth state management

```typescript
// Listen for auth changes
supabase.auth.onAuthStateChange((event, session) => {
  // event: SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED
  if (event === 'SIGNED_OUT') {
    // Clear local state, redirect to login
  }
})

// Get current user
const { data: { user } } = await supabase.auth.getUser()

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email, password
})
```

React integration: wrap in a context provider. Store auth state in React context, expose `user`, `signIn`, `signOut` methods.

### File uploads via Storage

```typescript
// Upload reference audio
const { data, error } = await supabase.storage
  .from('references')
  .upload(`${userId}/${voiceId}.wav`, file, {
    cacheControl: '3600',
    upsert: false,
  })

// Get signed URL for playback
const { data } = await supabase.storage
  .from('generations')
  .createSignedUrl(`${userId}/${generationId}.wav`, 3600) // 1hr

// Public URL (if bucket is public)
const { data } = supabase.storage
  .from('public-assets')
  .getPublicUrl('demo/sample.wav')
```

**Bucket layout:**
- `references` (private): `{user_id}/{voice_id}.{ext}` — voice reference audio
- `generations` (private): `{user_id}/{generation_id}.wav` — generated speech
- `public-assets` (public): demo clips, landing page audio

### Realtime subscriptions

```typescript
// Subscribe to task updates (replaces HTTP polling)
const channel = supabase
  .channel('task-updates')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'tasks',
    filter: `user_id=eq.${userId}`,
  }, (payload) => {
    const task = payload.new
    // Update UI with new task status
    if (task.status === 'completed') {
      // Show result, stop spinner
    }
  })
  .subscribe()

// Cleanup on unmount
return () => supabase.removeChannel(channel)
```

This replaces the current 500ms HTTP polling. Lower latency, fewer requests, less server load.

### Error handling

```typescript
// supabase-js error patterns
const { data, error } = await supabase.functions.invoke('api/generate', {
  body: { voice_id, text, language },
})

if (error) {
  // error is one of:
  // - FunctionsHttpError (non-2xx status from edge fn)
  // - FunctionsRelayError (edge fn crashed or unreachable)
  // - FunctionsFetchError (network error on client side)

  if (error instanceof FunctionsHttpError) {
    const errorBody = await error.context.json()
    // errorBody.message, errorBody.detail, etc.
  }
}

// PostgREST errors
const { data, error } = await supabase.from('voices').select('*')
if (error) {
  // error.message, error.code, error.details, error.hint
}
```

---

## 7. DevOps & Deployment

### Local development

```bash
# One-time setup
supabase init                    # creates supabase/ directory + config.toml
supabase start                   # starts Postgres, Auth, Storage, PostgREST, Realtime, Studio (Docker)

# Daily development
supabase functions serve         # hot-reload edge functions
npm run dev                      # Vite dev server (frontend)

# Local URLs after `supabase start`:
#   API:      http://127.0.0.1:54321
#   DB:       postgresql://postgres:postgres@127.0.0.1:54322/postgres
#   Studio:   http://127.0.0.1:54323
#   Inbucket: http://127.0.0.1:54324 (email testing)
#   Edge Fns: http://localhost:54321/functions/v1/<fn-name>
```

Frontend dev server proxies to `localhost:54321` instead of current `localhost:8000` (FastAPI).

### Migrations

```bash
# After making schema changes in Studio or SQL:
supabase db diff -f describe_change       # generates migration file
supabase db reset                          # verify migrations replay cleanly

# Review:
ls supabase/migrations/                    # timestamped SQL files

# Push to remote (staging):
supabase link --project-ref <staging-ref>
supabase db push --dry-run                 # preview
supabase db push                           # apply
```

**Seed data:** `supabase/seed.sql` runs after all migrations on `supabase start` and `supabase db reset`. Use for dev/test data only.

### Secrets management

| Environment | How |
|-------------|-----|
| Local | `supabase/functions/.env` file (gitignored) |
| Staging/Prod | `supabase secrets set KEY=value` or Dashboard |
| CI/CD | GitHub Actions secrets → `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID` |

Auto-populated in edge functions (no setup needed): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`.

Custom secrets we need: `MODAL_TOKEN`, `MISTRAL_API_KEY`, `STRIPE_SECRET_KEY` (later).

### Environment management

```
Local (free, Docker)
  ↓ supabase db push
Staging (Supabase project #1)
  ↓ CI/CD merge to main
Production (Supabase project #2)
```

Two Supabase projects minimum. Feature branches developed locally, merged to `develop` → staging, then `develop` → `main` → production.

### CI/CD pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy-staging.yml
name: Deploy to Staging
on:
  push:
    branches: [develop]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: latest

      - run: supabase link --project-ref ${{ secrets.STAGING_PROJECT_ID }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

      # Database migrations
      - run: supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.STAGING_DB_PASSWORD }}

      # Edge functions
      - run: supabase functions deploy
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

# Production workflow: same but triggers on push to main, uses PROD secrets
```

**Deploy all functions at once:** `supabase functions deploy` (since CLI v1.62.0) deploys every function in `supabase/functions/`.

---

## 8. Risk Register

### High-impact risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|-----------|------------|
| **Edge fn CPU limit (200ms) too tight for audio validation** | High | Medium | Keep audio validation lightweight (check headers, not decode full file). Heavy processing stays on Modal |
| **WebSocket edge fn hits 400s wall clock during long recordings** | High | Low | Most recordings are < 5min. Monitor. Fallback: direct Mistral connection from frontend |
| **Modal polling pattern requires rethinking** | Medium | Certain | Must move from background polling to on-demand check pattern. See section 5 |
| **Cold starts under burst traffic** | Medium | Medium | Fat function pattern reduces blast radius. Monitor p99 latency. Persistent storage if needed |
| **Connection pooler limits at scale** | Medium | Low | Default Supavisor pool size is 30 connections. Fine for early scale. Upgrade plan if needed |
| **RLS performance on large tables** | Medium | Low | Indexes on `user_id` columns (already planned). Use `(select auth.uid())` wrapper pattern |
| **Vendor lock-in** | Low | — | Supabase is open-source. Postgres is standard. Edge functions use Deno (open). Storage is S3-compatible. Migration path exists, but would be significant effort |

### Things edge functions CANNOT do

- **Persistent in-memory state** — stateless, no shared memory between invocations
- **Long-running background jobs** — 400s wall clock max. Use Modal/external workers
- **Serve HTML** — GET returning text/html is rewritten to text/plain
- **Heavy computation** — 200ms CPU limit. Audio encoding, ML inference → Modal
- **Scheduled execution natively** — use `pg_cron` + webhook to edge fn
- **Direct filesystem persistence** — only `/tmp` (ephemeral) or mounted S3 buckets

### Cost projections

| Component | Free Tier | Paid (Pro $25/mo) | Our Likely Usage |
|-----------|-----------|-------------------|------------------|
| Edge Function invocations | 500K/mo | 2M/mo included, then $2/1M | Low thousands initially |
| Database | 500MB | 8GB included | Well under 1GB for a while |
| Storage | 1GB | 100GB included | Depends on audio files — ~50MB/100 generations |
| Auth | 50K MAU | 100K MAU | < 1000 users initially |
| Realtime | 200 concurrent | 500 concurrent | < 50 concurrent |

Pro plan ($25/mo) covers us comfortably through early growth. Costs scale linearly and predictably.

### Open questions (need testing)

1. **Can edge functions receive 50MB file uploads?** — Docs don't explicitly state a request body size limit for edge functions. Need to test. Workaround: upload directly to Storage from frontend, then trigger edge fn.
2. **WebSocket in edge function + Mistral realtime WebSocket** — Can we proxy one WebSocket through another in a single edge fn? Docs say yes (inbound + outbound WS), but untested for our specific Mistral protocol.
3. **Edge function FormData parsing** — Deno's `Request.formData()` should work, but needs verification with large audio files.
4. **Realtime subscription filter performance** — `filter: user_id=eq.${id}` on tasks table. Should be fine with index, but verify with concurrent users.
5. **`supabase db diff` reliability** — Known to have failure cases. We should test with our specific schema changes and have a fallback plan (manual migration writing).

---

## Appendix: File Structure (target)

```
utter/
  frontend/                    # React SPA (unchanged location)
    src/
      lib/
        supabase.ts            # Supabase client init
        api.ts                 # Updated to use supabase.functions.invoke
        types.ts               # Updated types (generated from DB)
      components/
        auth/                  # New: login, signup, auth context
        tasks/                 # Updated: Realtime instead of polling
      pages/                   # Mostly unchanged, new auth flow
    .env.local                 # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

  supabase/
    config.toml                # Project config
    seed.sql                   # Dev seed data
    migrations/
      20260206000000_initial_schema.sql
      20260206000001_rls_policies.sql
      20260206000002_storage_buckets.sql
    functions/
      _shared/
        cors.ts
        supabase.ts
        modal.ts
        validation.ts
      api/
        index.ts               # Hono router — all API routes
    schemas/                   # Optional: declarative schema files

  .github/
    workflows/
      deploy-staging.yml
      deploy-production.yml
```

The backend directory (`backend/`) becomes obsolete after migration. FastAPI, SQLite, local file storage — all replaced by Supabase services.
