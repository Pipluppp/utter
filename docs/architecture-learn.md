# How the Supabase Backend Actually Works

> Companion to `architecture.md`. That doc tells you what to build. This one explains how the pieces work under the hood, why they exist, and how they compose into something that replaces a traditional server. Read this if you want to *understand* the architecture, not just follow it.

---

## The mental model shift

With FastAPI, we have a conventional server. A Python process runs continuously. It holds state in memory. It talks to SQLite on disk. When a request comes in, our code handles everything — routing, auth, validation, database queries, file I/O, background work. We wrote all of it.

Supabase inverts this. Instead of one monolithic server doing everything, you get a collection of specialized services that each handle one concern well. Your database becomes your API. Your auth system lives outside your code. Your file storage is a managed service. The only "server code" you write is for the parts that genuinely need custom logic.

This isn't just a deployment difference — it changes how you think about building features. In FastAPI, adding a "list voices" endpoint means writing a route handler, a database query, pagination logic, auth checking, and error formatting. In Supabase, you create a table with RLS policies and the API exists automatically. You only write an edge function when the built-in capabilities aren't enough.

The tradeoff is real, though. You gain speed and simplicity for common patterns. You lose fine-grained control and the ability to do "anything you want" in a single process. Understanding where that boundary sits is what this doc is about.

---

## Postgres is the center of everything

Traditional web architecture treats the database as a dumb store — your application server sits in front of it, mediating every interaction. Supabase's core insight is that Postgres is *already* capable of doing most of what application servers do. It can authenticate users, enforce access control, serve REST APIs, send real-time notifications, and run scheduled jobs. You just need the right tools plugged into it.

Every Supabase project starts with a full Postgres instance. Not a limited subset, not a proprietary wrapper — the real thing with full superuser access. You can install extensions, create custom functions, write complex queries, use CTEs, window functions, triggers, whatever Postgres supports. This matters because it means you're never locked into a subset of functionality. If Supabase's abstractions don't work for something, you can always drop down to raw SQL.

The other services — PostgREST, Auth, Realtime, Storage — are all satellites orbiting this Postgres core. They read from it, write to it, and respect its security model. Postgres is the source of truth, and everything else is infrastructure that makes it accessible in different ways.

### Why Postgres over SQLite

Our current SQLite setup works fine for single-user local development. But it falls apart for production multi-user:

- SQLite doesn't support concurrent writes from multiple connections well (write-ahead log helps, but it's still a single-writer model)
- No built-in network access — you can't connect to SQLite from a serverless function running somewhere else
- No Row Level Security — there's no concept of "this user can only see their rows"
- No replication, no point-in-time recovery, no managed backups

Postgres handles all of these natively. It's designed for concurrent access, networked connections, row-level security policies, and replication. The migration from SQLite to Postgres is mostly straightforward because SQLAlchemy (which we use) abstracts the differences. The schema concepts are nearly identical — tables, columns, types, foreign keys. The main additions are RLS policies and the `user_id` column on every table.

---

## PostgREST: how your database becomes an API

This is the most counterintuitive part of Supabase for developers coming from traditional frameworks.

PostgREST is an open-source Haskell server that reads your Postgres schema and generates a REST API from it automatically. Every table in your exposed schema gets full CRUD endpoints. Every view becomes a read-only endpoint. Every function becomes a callable RPC endpoint. You don't write route handlers. You don't write serialization logic. You don't write pagination code. PostgREST does all of it by introspecting the database catalog.

Here's what happens when you call `supabase.from('voices').select('*')`:

1. The supabase-js client constructs an HTTP GET request to `https://<ref>.supabase.co/rest/v1/voices`
2. It attaches two headers: `apikey: <anon-key>` (for the API gateway) and `Authorization: Bearer <user-jwt>` (for PostgREST)
3. The request hits the Supabase API gateway, which routes it to PostgREST
4. PostgREST reads the JWT from the Authorization header and extracts the Postgres role (`anon` or `authenticated`) and user claims
5. PostgREST opens a Postgres transaction and sets the role: `SET LOCAL ROLE authenticated`
6. It also sets request-specific variables: `SET LOCAL request.jwt.claims = '<jwt-payload>'`
7. It translates the HTTP request into SQL: `SELECT * FROM voices`
8. Postgres executes this query. Because RLS is enabled, Postgres automatically appends the RLS policy conditions to the query. Your `SELECT * FROM voices` actually becomes something like `SELECT * FROM voices WHERE user_id = (SELECT auth.uid())`
9. Results come back. PostgREST serializes them as JSON and returns the HTTP response

The magic is in steps 6-8. PostgREST doesn't enforce access control itself — it delegates that entirely to Postgres via RLS. This means the security model lives in the database, not in application code. You can't accidentally forget an auth check in a route handler because there are no route handlers.

### The supabase-js query builder

The client library provides a fluent API that maps to PostgREST's query parameters:

```typescript
// This builds a URL like:
// GET /rest/v1/generations?select=*,voices(name)&user_id=eq.abc&order=created_at.desc&limit=20&offset=0
const { data } = await supabase
  .from('generations')
  .select('*, voices(name)')       // joins via foreign key
  .eq('user_id', userId)           // WHERE user_id = ...
  .order('created_at', { ascending: false })
  .range(0, 19)                    // LIMIT 20 OFFSET 0
```

The `voices(name)` syntax is powerful — PostgREST reads foreign key relationships and lets you embed related data in a single request. No N+1 queries, no separate join endpoint. If `generations.voice_id` references `voices.id`, PostgREST knows how to join them.

The result of every query is `{ data, error }`. Never throws. You always check `error` explicitly. This is a deliberate design choice — it forces you to handle errors at every call site instead of relying on try/catch further up the stack.

### When PostgREST isn't enough

PostgREST is great for direct data access — reads, writes, filters, pagination. It's not great for:

- Multi-step operations (validate input → call external API → write multiple tables → upload file)
- External API calls (PostgREST only talks to Postgres)
- Complex business logic (conditional workflows, state machines)
- File handling (PostgREST deals in JSON, not binary data)

That's where edge functions come in. Think of PostgREST as the fast path for simple CRUD, and edge functions as the escape hatch for everything else.

---

## Row Level Security: the database as authorization layer

RLS is a Postgres feature (not a Supabase invention) that lets you define access control rules at the row level, directly in the database. When RLS is enabled on a table, every query against that table is automatically filtered by the policies you've defined. You can't bypass it from SQL — even `SELECT * FROM voices` gets filtered.

### How it actually works

When you create an RLS policy like this:

```sql
CREATE POLICY "users_read_own" ON voices
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
```

Postgres stores this as a predicate that gets appended to every SELECT query on the `voices` table when the current role is `authenticated`. Under the hood, your `SELECT * FROM voices` effectively becomes:

```sql
SELECT * FROM voices WHERE (SELECT auth.uid()) = user_id
```

This happens at the query planner level, not in application code. The database engine itself enforces it. You can't work around it with clever SQL because the predicate is injected before your query is optimized and executed.

### The role system

This depends on Postgres's role-based access control. Supabase defines several database roles:

- **`anon`**: represents unauthenticated users. When someone makes a request with just the anon API key (no user JWT), PostgREST runs queries as this role.
- **`authenticated`**: represents signed-in users. When a valid user JWT is present, PostgREST switches to this role and sets the JWT claims as session variables.
- **`service_role`**: the admin role. Bypasses RLS entirely. Used by edge functions for system operations.

When you write `TO authenticated` in a policy, you're saying "this policy only applies when the database session is running as the authenticated role." Anonymous users (the `anon` role) won't even have their policies evaluated — the role check fails first, and the query returns no rows.

### auth.uid() and auth.jwt()

These are Postgres functions that Supabase installs in the `auth` schema. They read from the session variables that PostgREST (or your edge function client) sets when it opens a connection.

`auth.uid()` is shorthand for `(auth.jwt()->>'sub')::uuid` — it extracts the user's UUID from the JWT's `sub` claim and casts it to a Postgres UUID type. This is what you compare against `user_id` columns in your policies.

`auth.jwt()` returns the entire JWT payload as a `jsonb` object. You can drill into it for more complex authorization:

```sql
-- Only allow if user has admin role in their app_metadata
auth.jwt()->'app_metadata'->>'role' = 'admin'

-- Only allow MFA-verified users
auth.jwt()->>'aal' = 'aal2'
```

### The initPlan optimization

There's a performance subtlety worth understanding. If you write your policy as:

```sql
USING (auth.uid() = user_id)
```

Postgres might call `auth.uid()` once per row it evaluates. On a table with 10,000 rows, that's 10,000 function calls. But if you wrap it:

```sql
USING ((SELECT auth.uid()) = user_id)
```

The `(SELECT ...)` wrapper causes Postgres to evaluate it as an `initPlan` — a subquery that runs once and caches the result. Now `auth.uid()` is called once, and the cached UUID is compared against each row. Same result, much faster.

This is a Postgres optimizer behavior, not a Supabase-specific thing. But it matters a lot for RLS performance on large tables.

### USING vs WITH CHECK

These are the two types of predicates in RLS policies, and they serve different purposes:

- **USING** filters which *existing* rows are visible. It applies to SELECT, UPDATE (which rows can be updated), and DELETE (which rows can be deleted).
- **WITH CHECK** validates *new* data. It applies to INSERT (what can be inserted) and UPDATE (what the row looks like after the update).

For a simple "users own their data" pattern, you typically need both:

```sql
-- UPDATE needs both: "can you see this row?" (USING) + "is the new version valid?" (WITH CHECK)
CREATE POLICY "update_own" ON voices
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)            -- can only update your own rows
  WITH CHECK ((SELECT auth.uid()) = user_id);       -- can't change user_id to someone else's
```

Without the WITH CHECK, a user could theoretically UPDATE a row's `user_id` to someone else's UUID, transferring ownership.

---

## JWTs: the trust carrier

JWTs (JSON Web Tokens) are the glue that connects auth to everything else. Understanding how they flow through the system explains a lot of "how does X know who I am?" questions.

### What's in a Supabase JWT

When a user signs in, Supabase Auth (GoTrue) creates a JWT with these claims:

```json
{
  "sub": "a1b2c3d4-...",           // user UUID — this is auth.uid()
  "role": "authenticated",         // Postgres role to use
  "aud": "authenticated",          // audience
  "iss": "https://<ref>.supabase.co/auth/v1",
  "iat": 1706745600,               // issued at
  "exp": 1706749200,               // expires (~1 hour later)
  "email": "user@example.com",
  "aal": "aal1",                   // authentication assurance level
  "session_id": "...",
  "app_metadata": { ... },         // server-controlled, trusted
  "user_metadata": { ... }         // user-modifiable, don't trust in RLS
}
```

The JWT is signed with the project's JWT secret. Anyone with the secret can create valid tokens, which is why the secret must never be exposed client-side.

### How JWTs flow through the system

```
User signs in
  → Supabase Auth creates JWT + refresh token
  → supabase-js stores them in memory (and optionally localStorage)
  → Every subsequent supabase-js call attaches: Authorization: Bearer <jwt>

Frontend → PostgREST:
  → API gateway verifies the JWT signature
  → PostgREST reads the "role" claim → SET LOCAL ROLE authenticated
  → PostgREST reads the full JWT → SET LOCAL request.jwt.claims = '...'
  → RLS policies use auth.uid() / auth.jwt() which read these session variables

Frontend → Edge Function:
  → API gateway verifies JWT signature (if verify_jwt = true)
  → Edge function code can read the Authorization header
  → Edge function creates a supabase client with the user's JWT
  → That client's queries go through PostgREST → RLS applies

Frontend → Storage:
  → JWT is sent in the Authorization header
  → Storage API checks RLS policies on storage.objects table
  → File access is granted or denied based on the policies
```

The key insight: the JWT is the *only* thing that establishes identity. There's no server-side session store, no cookie-based auth, no session ID lookup. The JWT itself contains everything needed to authorize a request. This is what makes the architecture stateless — any edge function, in any region, can validate the token and know who the user is.

### Token refresh

JWTs expire (default ~1 hour). The supabase-js client handles refresh automatically:

1. When the access token is close to expiry, supabase-js sends the refresh token to Auth
2. Auth verifies the refresh token (single-use, rotated on each refresh)
3. Auth issues a new access token + new refresh token
4. supabase-js stores the new pair, discards the old ones

This happens in the background. Your application code never needs to think about it. If the refresh fails (user signed out on another device, refresh token expired), supabase-js fires a `SIGNED_OUT` event and your auth state listener handles the redirect to login.

---

## Edge functions: Deno on the edge

Edge functions are the "custom backend" part of Supabase. They run your TypeScript/JavaScript code on Deno — a modern JavaScript runtime created by Ryan Dahl (who also created Node.js). They're deployed globally, running in V8 isolates close to your users.

### What Deno is

Deno is a JavaScript/TypeScript runtime, like Node.js, but with different design choices:

- **TypeScript native**: no build step needed. Write `.ts` files and they just work.
- **Web-standard APIs**: uses `fetch`, `Request`, `Response`, `URL`, `crypto`, `WebSocket` — the same APIs browsers use. If you know browser JavaScript, you mostly know Deno.
- **Secure by default**: no file system, network, or environment access unless explicitly granted. (In the Supabase context, the platform grants these permissions.)
- **No `node_modules`**: imports use URLs or the `npm:` prefix. `import express from 'npm:express@4'` downloads and caches the package.

The practical impact for us: most of our edge function code will look like standard TypeScript using `fetch()` for HTTP calls, `Deno.env.get()` for environment variables, and `npm:@supabase/supabase-js@2` for database access. It's not radically different from writing Node.js — just a few import syntax differences.

### How V8 isolates work

Each edge function runs in a V8 isolate — a lightweight, sandboxed execution environment. Think of it as a mini-process that starts fast (milliseconds) and has strict resource limits.

When a request hits your function:

1. **Cold start (first request)**: The ESZip bundle (your function + dependencies, pre-compiled) is loaded into a new V8 isolate. This takes milliseconds because ESZips are compact and pre-processed.
2. **Execution**: Your `Deno.serve()` handler runs. It processes the request, makes database calls, calls external APIs, and returns a response.
3. **Warm state**: After the response is sent, the isolate stays alive for a while (plan-dependent). Subsequent requests reuse the same isolate — no cold start.
4. **Shutdown**: Eventually, if no requests arrive, the isolate is terminated. Its memory is freed. Any in-memory state is lost.

This is fundamentally different from a FastAPI server, which runs continuously and can hold state between requests. In an edge function, every invocation might be the first one. You can't rely on module-level variables persisting. You can't run a background loop that polls an API every 10 seconds. You process a request and return.

### The 200ms CPU limit

This is the most important constraint to internalize. Wall clock time (400s) is generous — you can wait for slow external APIs. But CPU time — actual computation cycles — is limited to 200ms per invocation.

What counts as CPU time:
- Parsing JSON
- String manipulation
- Iterating over arrays
- Encoding/decoding data
- Any synchronous JavaScript execution

What does NOT count:
- Waiting for `fetch()` to complete (network I/O)
- Waiting for database queries (I/O wait)
- `await` pauses (the CPU is idle)

For Utter, this works fine. Our edge functions are orchestrators — they validate input (fast), call Modal's API (network wait), write to the database (network wait), and return. The actual CPU work is minimal. The heavy computation (TTS inference, audio processing) happens on Modal's GPUs, not in our edge function.

Where it could be tight: parsing/validating a large audio file header, doing base64 encoding of audio data, or running complex text processing. If any of these approach 200ms, they need to be offloaded.

### EdgeRuntime.waitUntil()

Edge functions have a neat escape hatch for fire-and-forget work:

```typescript
Deno.serve(async (req) => {
  // Do the main work, return response fast
  const result = await processRequest(req)

  // Fire-and-forget: log to analytics, clean up temp files, etc.
  EdgeRuntime.waitUntil(
    fetch('https://analytics.example.com/events', {
      method: 'POST',
      body: JSON.stringify({ event: 'generation_completed' })
    })
  )

  return new Response(JSON.stringify(result))
})
```

The response is sent immediately, but the isolate stays alive until the `waitUntil` promise resolves. This is useful for non-critical background work that shouldn't slow down the response.

---

## Supabase Auth: GoTrue under the hood

Supabase Auth is a Go service called GoTrue (open source). It handles user registration, login, password resets, OAuth flows, magic links, and token management. It stores user data in the `auth.users` table in your Postgres database.

### Why not roll our own?

Auth is a security-critical system where mistakes are expensive. Password hashing, token rotation, CSRF protection, rate limiting, email verification, OAuth state management — each of these has subtle security implications. GoTrue handles all of them, battle-tested across thousands of Supabase projects.

For Utter, we need:
- Email/password sign-up and sign-in
- Possibly Google OAuth later
- User sessions with automatic token refresh
- A user UUID that we can use in RLS policies

Supabase Auth gives us all of this with zero custom code. The `auth.users` table is pre-created. We don't need our own users table — we just reference `auth.users(id)` with foreign keys from our application tables.

### The auth.users table

This table lives in the `auth` schema (not `public`). It contains:

- `id`: UUID, the user's unique identifier. This is what `auth.uid()` returns.
- `email`: the user's email address
- `encrypted_password`: bcrypt hash (never readable via API)
- `raw_app_meta_data`: jsonb, only modifiable server-side. Use for roles, permissions.
- `raw_user_meta_data`: jsonb, modifiable by the user. Use for display name, avatar URL.
- `created_at`, `updated_at`, `last_sign_in_at`: timestamps

You can reference `auth.users(id)` in foreign keys from your own tables:

```sql
CREATE TABLE public.voices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- ...
);
```

The `ON DELETE CASCADE` means that if a user is deleted from Auth, their voices are automatically deleted. No orphaned data.

### PKCE flow vs implicit flow

For SPAs (like our React frontend), Supabase Auth uses the **implicit flow** by default — tokens are returned directly after authentication. For server-side rendering, it uses **PKCE** (Proof Key for Code Exchange), which is more secure but requires a server-side code exchange step.

Since we're a pure SPA, implicit flow works fine. supabase-js handles the entire flow:

```typescript
// This triggers the full OAuth dance under the hood
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: 'https://utter.app/auth/callback' }
})
// User is redirected to Google → signs in → redirected back
// supabase-js picks up the tokens from the URL fragment → stores them
```

---

## Realtime: Postgres WAL as event source

Supabase Realtime is how we replace HTTP polling with push-based updates. Instead of the frontend asking "is my task done yet?" every 500ms, the database tells the frontend when something changes.

### How it works under the hood

Postgres has a feature called **logical replication** that streams a log of all data changes (inserts, updates, deletes) to subscribers. This is the Write-Ahead Log (WAL) — the same mechanism Postgres uses for crash recovery and replication.

Supabase runs a Realtime Server (an Elixir/Phoenix application) that:

1. Connects to Postgres as a logical replication subscriber
2. Reads the WAL stream — every INSERT, UPDATE, DELETE on subscribed tables
3. For each change, checks which client subscriptions match (based on table, event type, filter)
4. Pushes matching changes to connected clients via WebSocket

From the frontend, you subscribe to changes:

```typescript
supabase
  .channel('task-updates')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'tasks',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    // payload.new = the updated row
    // payload.old = the previous row values
    console.log('Task updated:', payload.new.status)
  })
  .subscribe()
```

The `filter` is important — without it, you'd receive updates for all rows in the table (including other users' tasks). The filter is applied server-side by the Realtime Server, so filtered-out events never reach the client.

### Why this matters for Utter

Our current architecture polls `GET /api/tasks/:id` every 500ms. That's 120 requests per minute per active task. If 10 users are waiting for generations simultaneously, that's 1,200 requests per minute hitting our server.

With Realtime, each user opens one WebSocket connection. When an edge function updates a task row (setting status to "completed"), Postgres writes that change to the WAL, the Realtime Server picks it up, and pushes it to the subscribed client. One database write triggers one push notification. No polling, no wasted requests.

The latency is typically in the tens of milliseconds — much faster than the 500ms polling interval. Users see their task complete almost instantly.

### RLS and Realtime

Realtime respects RLS policies. When a client subscribes, the Realtime Server checks whether the user's JWT grants access to the rows that match the subscription filter. If an UPDATE happens on a row the user doesn't have SELECT access to (per RLS), the event is suppressed — the user never sees it.

This means you don't need separate authorization logic for Realtime subscriptions. The same RLS policies that protect your PostgREST queries also protect your Realtime subscriptions.

---

## Storage: S3 with Postgres metadata

Supabase Storage is an S3-compatible object store with a twist — file metadata lives in Postgres, and access control uses RLS.

### How it works

Files are stored in an S3-compatible backend. Metadata (bucket, path, owner, timestamps, MIME type) is stored in the `storage.objects` table in Postgres. When you upload a file:

1. Your request hits the Storage API
2. Storage checks RLS policies on `storage.objects` for INSERT permission
3. If allowed, the file is written to S3 and a metadata row is inserted into `storage.objects`
4. The `owner_id` column is automatically set to `auth.uid()` of the uploader

When you download a file:

1. For private buckets: Storage checks RLS policies on `storage.objects` for SELECT permission
2. For public buckets: no check needed, the file is served directly from CDN

### Signed URLs

For audio playback in Utter, signed URLs are the right pattern:

```typescript
const { data } = await supabase.storage
  .from('generations')
  .createSignedUrl('user123/gen456.wav', 3600) // valid for 1 hour

// data.signedUrl = https://<ref>.supabase.co/storage/v1/object/sign/generations/user123/gen456.wav?token=...
```

The signed URL contains a time-limited token. Anyone with the URL can access the file for the duration — no auth headers needed. This is perfect for audio playback because the browser's `<audio>` element can't attach Authorization headers.

### Storage RLS for Utter

Our storage buckets need policies that restrict access to file owners:

```sql
-- Users can upload to their own folder
CREATE POLICY "upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'references'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own files
CREATE POLICY "read_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('references', 'generations')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

The `storage.foldername()` function extracts path segments. Since we organize files as `{user_id}/{file_id}.wav`, the first folder segment is the user's UUID. The policy checks that it matches the authenticated user.

Important: you can never INSERT/UPDATE/DELETE rows in `storage.objects` directly via SQL. All mutations must go through the Storage API. The Postgres table is metadata-only; the actual file bytes live in S3.

---

## How our current features map to Supabase

Let's trace through two key Utter features to see how they work end-to-end in the new architecture.

### Feature: speech generation

**Current (FastAPI):**
1. Frontend POSTs to `/api/generate` with voice_id, text, language
2. FastAPI validates input, creates a Generation record in SQLite
3. FastAPI creates an in-memory Task, returns task_id
4. Background thread submits job to Modal, polls every 5-10s
5. Frontend polls `/api/tasks/:id` every 500ms
6. When Modal finishes, background thread saves audio to `uploads/generated/`, updates Generation
7. Frontend sees task completed, fetches audio from `/uploads/generated/gen_id.wav`

**New (Supabase):**
1. Frontend calls `supabase.functions.invoke('api/generate', { body: { voice_id, text, language } })`
2. Edge function validates input, extracts user from JWT
3. Edge function creates a Generation row + Task row in Postgres (service role, bypasses RLS)
4. Edge function submits job to Modal via HTTP, stores `modal_job_id` in task metadata
5. Edge function returns `{ task_id, status: 'processing' }` — the request is done
6. Frontend subscribes to task row via Realtime: `supabase.channel(...).on('postgres_changes', ...)`
7. Frontend periodically calls a lightweight check endpoint: `supabase.functions.invoke('api/tasks/:id/check')`
8. That check edge function polls Modal once, and if done: downloads audio → uploads to Storage → updates task row
9. Realtime pushes the task UPDATE to the frontend instantly
10. Frontend gets a Storage signed URL for the audio file

The key differences: task state is durable (database, not memory), audio is in managed storage (CDN-backed, not local filesystem), auth is built-in, and updates are push-based (Realtime, not polling).

### Feature: voice cloning

**Current (FastAPI):**
1. Frontend POSTs multipart form to `/api/clone` with audio file, name, transcript, language
2. FastAPI validates audio (duration, format), saves to `uploads/references/`
3. FastAPI creates Voice record in SQLite
4. Returns voice ID immediately

**New (Supabase):**
1. Frontend calls `supabase.functions.invoke('api/clone', { body: formData })`
2. Edge function extracts user from JWT
3. Edge function validates audio file (check headers — don't decode the full file, CPU limit)
4. Edge function uploads audio to Storage: `supabase.storage.from('references').upload(...)`
5. Edge function creates Voice row in Postgres with `reference_path` pointing to Storage path
6. Returns voice ID

This is simpler because cloning is a synchronous operation (no Modal job, no polling). The main change is that file storage moves from local disk to Supabase Storage.

---

## The connection pooler: Supavisor

When you have many short-lived processes (like edge functions) all connecting to Postgres, you need a connection pooler. Opening a new Postgres connection is expensive — TCP handshake, TLS negotiation, authentication, process creation on the Postgres side. A single connection takes ~50-100ms to establish and consumes ~10MB of memory on the Postgres server.

Supavisor sits between your application and Postgres. It maintains a pool of persistent connections to Postgres and lends them out to clients as needed:

```
Edge Function A ─┐
Edge Function B ─┤──→ Supavisor ──→ [Pool of 30 connections] ──→ Postgres
Edge Function C ─┤
Browser Client  ─┘
```

**Transaction mode** (port 6543): The connection is only allocated while a query is running. Between queries, it's returned to the pool. This means 1,000 concurrent edge functions can share 30 Postgres connections. The tradeoff: prepared statements don't work (the connection might be different for each query).

**Session mode** (port 5432): The connection is allocated for the entire session. One pooler connection per client. Supports prepared statements but can exhaust the pool with many concurrent clients.

For edge functions, transaction mode is the right choice. supabase-js uses it by default. You never need to configure this manually — the environment variables are pre-set.

---

## Putting it all together: the request lifecycle

Here's what happens from the moment a user clicks "Generate" to hearing their audio:

```
1. User clicks Generate button in React SPA

2. React calls supabase.functions.invoke('api/generate', {
     body: { voice_id: '...', text: '...', language: 'en' }
   })

3. supabase-js constructs:
   POST https://xyz.supabase.co/functions/v1/api/generate
   Headers: Authorization: Bearer eyJhbG...  (user's JWT)
            Content-Type: application/json
   Body: {"voice_id":"...","text":"...","language":"en"}

4. Request hits Supabase's global API gateway
   → Gateway checks the JWT signature against the project's JWT secret
   → Routes to the nearest Edge Function deployment

5. Edge function starts (cold or warm isolate)
   → Hono router matches POST /api/generate
   → Handler extracts JWT, calls supabase.auth.getUser(token) → gets user UUID
   → Validates input (voice exists, text length ok, user owns the voice)
   → Creates Generation row in Postgres (service role client, bypasses RLS)
   → Creates Task row in Postgres (status: 'processing')
   → Submits job to Modal: fetch('https://modal.run/...', { method: 'POST', body: audioData })
   → Stores Modal job_id in task.metadata
   → Returns { task_id: '...', status: 'processing' }

6. Edge function's response flows back through the gateway to the frontend

7. Frontend receives the task_id
   → Subscribes to Realtime: supabase.channel('...').on('postgres_changes', {
       event: 'UPDATE', table: 'tasks', filter: 'id=eq.<task_id>'
     })
   → Starts a timer to call the check endpoint every few seconds

8. Every few seconds, frontend calls supabase.functions.invoke('api/tasks/:id/check')
   → Edge function reads the task row
   → Calls Modal status API for the job_id
   → If still running: returns { status: 'processing' } (maybe updates progress in metadata)
   → If failed: updates task to 'failed', returns error
   → If done:
     → Downloads audio from Modal
     → Uploads to Supabase Storage: supabase.storage.from('generations').upload(...)
     → Updates Generation row (audio_path, duration, status='completed')
     → Updates Task row (status='completed', result={audio_path, duration})

9. The Task UPDATE triggers Postgres WAL → Realtime Server → WebSocket push to frontend

10. Frontend receives the Realtime event with the completed task
    → Reads audio_path from task.result
    → Generates signed URL: supabase.storage.from('generations').createSignedUrl(...)
    → Plays audio via WaveSurfer.js using the signed URL
```

Every numbered step uses a different Supabase service: Auth (JWT), Edge Functions (custom logic), PostgREST (database reads via RLS), Storage (file hosting), Realtime (push notifications). They compose together because they all share the same JWT trust model and the same Postgres database.

---

## What we gain, what we lose

### Gains

- **No server to manage.** No VMs, no Docker in production, no uptime monitoring of our backend process.
- **Multi-tenant by default.** RLS enforces user isolation at the database level. Can't accidentally leak data between users.
- **Durable task state.** Tasks survive crashes, deploys, and restarts. In-memory TaskStore was always fragile.
- **CDN-backed audio.** Storage signed URLs are served from CDN edge locations. Faster audio loading globally.
- **Built-in auth.** No password hashing bugs, no session management code, no JWT signing code.
- **Real-time updates.** Push-based task notifications replace polling. Lower latency, fewer requests.
- **Scalability.** Edge functions auto-scale. Postgres handles concurrent connections via Supavisor. No capacity planning for the server itself.

### Losses

- **No persistent in-process state.** Can't hold a connection open to Modal and poll in the background. Must restructure the polling pattern.
- **200ms CPU limit.** Can't do any compute-heavy work in edge functions. All heavy lifting must be on Modal.
- **Deno, not Node.** Most npm packages work, but some Node-specific code (native addons, fs-heavy packages) won't.
- **Less debugging visibility.** Can't SSH into the server, attach a debugger to a running process, or `tail -f` a log file. Debugging is through the dashboard logs and local development.
- **Vendor coupling.** While Supabase is open-source, migrating away would mean replacing Auth, Storage, Realtime, and edge functions simultaneously. The data (Postgres) is portable, but the infrastructure around it isn't.
- **Learning curve.** RLS policies, JWT flows, edge function constraints, Storage policies — there's a lot of new concepts to internalize. This doc is trying to help with that.

### The bottom line

For Utter's stage and needs, the gains dramatically outweigh the losses. We're a small team building a voice cloning app, not a high-frequency trading platform. We need auth, file storage, real-time updates, and a place to run API handlers. Supabase provides all of these as managed services, letting us focus on the product (voice cloning UX, Modal integration, transcription) rather than infrastructure.

The only significant architectural change is the Modal polling pattern, and the solution (on-demand checks instead of background polling) is straightforward. Everything else maps cleanly from what we have to what Supabase provides.
