# Supabase Security Guide

Last updated: **2026-02-07**

This doc is the security reference for Utter's target deployment:

- Frontend: **Vercel** hosting a **React + Vite SPA**
- Backend: **Supabase** (Postgres + Auth + Storage + Edge Functions)
- Compute: **Modal** for long-running GPU work (TTS)

Related:

- `docs/architecture.md` - overall backend architecture and data model
- `docs/vercel-frontend.md` - frontend deployment and `/api/*` rewrite strategy

It covers what we must not get wrong, concrete patterns for known pitfalls, and links to official docs. This should be read by any developer working on the Supabase side of Utter.

---

## 1) Core principle: Supabase is public by design

Assume attackers can:

- see your Supabase project URL
- call PostgREST/Data API endpoints
- call Edge Functions endpoints

**Hiding endpoints behind a Vercel rewrite is not a security boundary.** Our `/api/*` rewrite (see `vercel-frontend.md`) is routing convenience (same-origin requests), not access control. The Supabase project URL is not secret — it's in `vercel.json`, in the anon key's JWT payload, and in every browser request.

Security must be enforced by:

- **RLS policies** (database and Storage policies)
- **Edge Function auth checks** (JWT verification patterns, webhook signature verification)
- **least-privilege grants** / **hardening the Data API surface**

---

## 2) Keys: what is safe in the browser (and what is not)

Safe to expose in the browser (expected):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` / publishable key

Never expose publicly:

- `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS)
- database URLs/passwords
- JWT secrets / signing secrets

Official docs:

- API keys overview: https://supabase.com/docs/guides/api/api-keys

---

## 3) RLS is non-optional (database)

Rules for Utter:

- Enable **RLS on every table** that is reachable from the Data API.
- Write policies so that the “default” is **deny**.
- Put tenant boundaries on `user_id` everywhere (`voices`, `generations`, `tasks`, etc.).
- Write RLS policies with performance in mind:
  - wrap `auth.uid()` as `(select auth.uid())` to avoid per-row function calls on large scans
  - ensure columns referenced by policies (typically `user_id`) are indexed
- Prefer doing complex invariants via:
  - Postgres functions (RPC) executed under RLS, or
  - Edge Functions that validate, then write as the server where appropriate.

Official docs:

- RLS guide: https://supabase.com/docs/guides/database/postgres/row-level-security
- Securing your API: https://supabase.com/docs/guides/api/securing-your-api

---

## 3b) RLS does NOT protect columns — only rows

This is the single most misunderstood Supabase security limitation and the source of real-world exploits (see [discussion #20074](https://github.com/orgs/supabase/discussions/20074), [discussion #656](https://github.com/orgs/supabase/discussions/656)).

**The problem**: If a user has UPDATE permission on a table, RLS only controls *which rows* they can touch — not *which columns*. Your frontend may only send `{ display_name: "new name" }`, but an attacker can craft a direct PostgREST request that also sets `role`, `credits`, `user_id`, `created_at`, or any other column.

**VIEWs do not fix this.** If the user has UPDATE on the underlying table, they can bypass the view's column restrictions entirely.

### The fix: BEFORE UPDATE triggers with column allowlists

This is the accepted pattern (confirmed by Supabase team). Create a trigger that explicitly allowlists which columns the authenticated user may modify:

```sql
-- Example: users can only update their own display_name and avatar_url
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
as $$
begin
  -- Reject changes to any column not in the allowlist
  if NEW.id         IS DISTINCT FROM OLD.id         then raise exception 'cannot modify id'; end if;
  if NEW.user_id    IS DISTINCT FROM OLD.user_id    then raise exception 'cannot modify user_id'; end if;
  if NEW.role       IS DISTINCT FROM OLD.role       then raise exception 'cannot modify role'; end if;
  if NEW.credits    IS DISTINCT FROM OLD.credits    then raise exception 'cannot modify credits'; end if;
  if NEW.created_at IS DISTINCT FROM OLD.created_at then raise exception 'cannot modify created_at'; end if;
  if NEW.updated_at IS DISTINCT FROM OLD.updated_at then raise exception 'cannot modify updated_at'; end if;

  return NEW;
end;
$$;

create trigger guard_profile_update
  before update on profiles
  for each row execute function public.guard_profile_update();
```

**Design choice — blocklist vs allowlist**:
- The example above is a **blocklist** (reject named columns). Simpler for tables with few protected columns.
- For tables where users should only touch 1-2 columns, flip to an **allowlist**: check that *only* the permitted columns changed, reject everything else.
- Allowlists are safer by default — new columns are automatically protected.

### When to use this

Apply column-guard triggers to **every table where the client has direct UPDATE access** and there are columns the user must never control.

**Utter-specific note:** Our architecture (see `docs/architecture.md`) routes most writes through Edge Functions with `service_role`, which means the client never has direct INSERT/UPDATE on those tables. Currently:

- **`generations`** and **`tasks`**: written exclusively by Edge Functions. No INSERT/UPDATE granted to `authenticated`. Column-guard triggers are **not needed** — the grant itself is absent.
- **`voices`**: in Option A, voice creation/updates are server-only via `/api/*` Edge Functions (service role). We still allow direct client DELETE on own rows. If we ever grant direct client UPDATE in the future (e.g., rename), add column-level protections (privileges and/or triggers) to prevent tampering with server-owned fields like `user_id`, `source`, and storage object keys.
- **`profiles`**: we will maintain a `public.profiles` table (keyed by `auth.users.id`) for app-specific user data (display name, billing state, credits). `auth.users` remains the identity source but is not exposed via PostgREST.

**Rule of thumb:** If the `authenticated` role has any direct INSERT/UPDATE/DELETE grants on a table, assume attackers can exploit PostgREST to craft arbitrary writes. Either (a) remove the grant and route the write through an Edge Function/RPC, or (b) add column-level protections (privileges and/or triggers) for server-owned fields.

### Utter-specific gap: `profiles` has server-owned fields (credits/tier)

Utter's `public.profiles` table is expected to contain **server-owned** fields (for example `credits_remaining` and `subscription_tier`) that must not be user-editable.

If `authenticated` users can update their own `profiles` row (RLS allows row access, and UPDATE is granted), they can bypass the SPA and update **any column on their own row** via the Data API.

Why this matters:
- If we enforce usage limits or billing based on `profiles.credits_remaining` / `subscription_tier`, this becomes a trivial self-serve escalation unless we add column guards.
- Even if the frontend UI never exposes these fields, the browser is not the security boundary (see section 1 and 3b).

Recommended fixes (pick one; do before any paid/credit gating):
1. **Server-only updates (recommended)**:
   - Revoke `UPDATE` on `public.profiles` from `authenticated`.
   - Keep `/api/profile` (Edge Function) or a `security definer` RPC as the only write path, and allowlist only safe fields like `handle`, `display_name`, `avatar_url`.
   - Update credits/tier exclusively in Edge Functions (service role) and/or trusted RPC.
2. **Keep client UPDATE but add column guards**:
   - Add a `BEFORE UPDATE` trigger on `public.profiles` that rejects changes to server-owned columns and only permits a small allowlist.

If we do neither, assume `credits_remaining` and `subscription_tier` are attacker-controlled values.

**Current Utter enforcement:** `UPDATE` is revoked from `authenticated` on `public.profiles`, and profile edits go through `/api/profile` using trusted server-side validation.

---

## 3c) Indexing and query performance (security-adjacent)

Poor performance becomes a security problem when it:

- forces you to add dangerous caches, or
- makes RLS checks so slow that you start bypassing them.

Minimum expectations for Utter:

- Index every `user_id` column used in RLS policies.
- Index foreign key columns (Postgres does not create FK indexes automatically).
- Use composite indexes that match real query patterns (e.g. `(user_id, created_at desc)` for history pages).

References:

- Indexes on WHERE/JOIN columns: https://supabase.com/docs/guides/database/query-optimization
- RLS performance notes: https://supabase.com/docs/guides/database/postgres/row-level-security#rls-performance-recommendations

---

## 4) Harden the Data API surface (defense-in-depth)

Even if the frontend only ever calls our `/api/*` Edge router, the Data API still exists. Anyone with the project URL and a valid JWT (or just the anon key) can:

- **SELECT** any table/view in an exposed schema (filtered by RLS)
- **INSERT** rows with arbitrary column values
- **UPDATE** rows they can access, setting **any column** (RLS only filters rows, not columns — see 3b)
- **DELETE** rows they can access
- **Call any RPC** (Postgres function) exposed in the schema

This is not a vulnerability — it's by design. But it means **the Data API is your real API**, regardless of what your frontend does.

### Hardening options (use all that apply)

1. **Restrict exposed schemas** — don't expose everything in `public`. Move internal/admin tables to a `private` schema that PostgREST cannot reach.
2. **Revoke unnecessary grants** — the `anon` and `authenticated` roles should only have SELECT/INSERT/UPDATE/DELETE on tables they genuinely need. Don't rely on RLS alone; remove the permission entirely if a role should never write to a table.

   **Utter-specific grants** (derived from the decision matrix in `architecture.md`):

   ```sql
   -- generations: only Edge Functions write (service_role). Client reads and deletes.
   revoke insert, update on public.generations from authenticated;

   -- tasks: only Edge Functions write. Client reads only.
   revoke insert, update, delete on public.tasks from authenticated;

   -- profiles: server-only update path (/api/profile or RPC)
   revoke update on public.profiles from authenticated;

   -- voices: no direct INSERT/UPDATE from authenticated (edge functions create rows)
   revoke insert, update on public.voices from authenticated;

   -- anon role should have no write access to any application table
   revoke insert, update, delete on public.voices from anon;
   revoke insert, update, delete on public.generations from anon;
   revoke insert, update, delete on public.tasks from anon;
   ```

3. **Prefer hardening over “turning off PostgREST”**: RPC calls (`/rest/v1/rpc/*`) are served by the same PostgREST surface. In practice, you usually harden by restricting exposed schemas and revoking grants, rather than expecting to disable “the Data API” while still using RPC.
4. **Use `security definer` functions** for complex write operations that need validation, and expose only the function (not the underlying table) to the client.

Official docs:

- Hardening the Data API: https://supabase.com/docs/guides/database/hardening-data-api

---

## 5) Edge Functions security: auth, secrets, and webhooks

Edge Functions are where we put:

- Modal orchestration (submit/poll/finalize)
- Stripe checkout + webhooks
- Storage signed upload URLs
- server-owned writes (tasks, generation finalization, credit deduction)

Rules:

- Treat Edge Functions as the trusted “backend code”.
- Store secrets using Supabase secrets (not in the frontend build).
- Only disable auth/JWT checks for endpoints like **webhooks**, and then verify the webhook signature instead.
- Keep database transactions short: don't hold DB locks while calling Modal/Stripe. Do external calls outside transactions; only lock rows for the final update.
- Be aware of the **Vercel 120s proxy timeout** on `/api/*` rewrites (see `vercel-frontend.md`). If an Edge Function takes longer than 120s to respond, Vercel returns a 504. This is why generation and clone flows use "submit fast, poll to finalize" — the initial request returns immediately, and finalization happens in subsequent lightweight poll requests.

Official docs:

- Edge Functions overview: https://supabase.com/docs/guides/functions
- Securing Edge Functions: https://supabase.com/docs/guides/functions/auth
- Function secrets / env vars: https://supabase.com/docs/guides/functions/secrets

---

## 5b) Server-side validation: when the client should NOT write directly

A recurring theme in Supabase security incidents: developers let the client INSERT/UPDATE directly via the Data API, then try to retroactively validate with RLS. This works for simple row-ownership checks but fails for **business logic invariants**.

### Use Edge Functions (or DB functions) for writes when:

- The write involves **multiple tables** that must stay consistent (e.g., create a generation + task row atomically).
- The write requires **external calls** (e.g., submit a Modal job, call Mistral for transcription).
- The write should set **server-controlled fields** (e.g., `created_at`, `status`, `modal_job_id`). If the client can set these, they will be spoofed.
- The operation has **side effects** (upload to Storage, trigger Modal job, update task state).

**Utter already follows this pattern for most writes** (see `architecture.md` decision matrix). `generations` and `tasks` are only writable by Edge Functions. The key is ensuring this remains true — don't add direct PostgREST write access to these tables "for convenience."

### Pattern: Edge Function as the write gateway

```
Client → Edge Function (validates + authorizes) → supabaseAdmin.from('table').insert(...)
```

The Edge Function uses `service_role` to write, so the client never has direct INSERT/UPDATE on the table. The grant revocations in section 4 enforce this at the database level.

This is the strongest protection: no RLS bypass matters because the role has no permission at all.

**Utter examples:**

- **Generate**: `POST /api/generate` → Edge Function validates input + JWT → creates `generations` + `tasks` rows → submits Modal job → returns task_id. Client never touches these tables directly.
- **Clone**: `POST /api/clone/upload-url` → Edge Function returns a signed upload URL → client uploads directly to Storage → `POST /api/clone/finalize` → Edge Function validates the upload, creates the `voices` row with server-controlled fields (`source`, `reference_path`, `created_at`).
- **Task finalization**: `GET /api/tasks/:id/check` → Edge Function polls Modal once → if done, uploads audio to Storage, updates `generations` and `tasks` rows.

### Pattern: Database function (RPC) as the write gateway

For simpler operations that don't need external calls:

```sql
-- Example: if we add a "rename voice" feature, an RPC prevents
-- the client from modifying any field except the name
create or replace function public.rename_voice(p_voice_id uuid, p_new_name text)
returns void
language plpgsql
security definer  -- runs as the function owner, not the caller
set search_path = ''  -- prevent search_path injection
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  update public.voices
  set name = p_new_name
  where id = p_voice_id and user_id = v_user_id;

  if not found then
    raise exception 'voice not found or not owned by user';
  end if;
end;
$$;

-- Client calls: supabase.rpc('rename_voice', { p_voice_id: '...', p_new_name: '...' })
-- The client cannot modify user_id, source, reference_path, or any other field.
```

This is a lighter alternative to an Edge Function when no external calls are needed. The tradeoff vs. a column-guard trigger: RPC is explicit (you write the update yourself), triggers are implicit (block bad updates at the DB level). Use RPC when you want the function to be the *only* write path; use triggers as a safety net when direct UPDATE is also allowed.

**`security definer` warning**: These functions run with the owner's permissions (typically superuser). Always:
- Set `search_path = ''` and fully qualify table names.
- Validate all inputs inside the function.
- Keep the function body minimal — don't call external services from here.

---

## 5c) Abuse prevention and cost containment (Edge invocations + provider spend)

Supabase is public-by-design (section 1). Assume:
- Anyone can send traffic to your Edge Function URL (even unauthenticated).
- Authenticated users can always replay SPA requests outside the UI.
- Every request counts toward Edge Function usage, and some requests may trigger real downstream cost (Modal today; Qwen API later).

Design goals:
- Make unauthenticated requests cheap (fast 401; do not write to DB; do not call external providers).
- Make authenticated abuse bounded (rate limits, concurrency limits, and credit/quota enforcement).

Mitigations (Utter-specific):
1. **Auth-gate all expensive endpoints**: generate/clone/design must require a valid user JWT before any DB writes, Storage operations, or provider calls.
2. **Enforce credits/quotas server-side before provider calls**:
   - Check and decrement available credits atomically in the database.
   - Only after the decrement succeeds, submit a Modal job or open a Qwen realtime session.
   - Tie this to section 3b: credit enforcement is meaningless if credits are client-writable.
3. **Rate-limit and bound concurrency**:
   - Keep the "one active generate per user" constraint and add similar guards where needed.
   - Add per-user request rate limits (DB-backed counters or a small rate-limit table).
4. **Harden signup in production**:
   - Enable email confirmations and consider restricting signups if abuse appears.
5. **Observability**:
   - Log provider request IDs and correlate them to `user_id`/`task_id` so anomalies can be detected and users can be blocked.

Reminder: hiding behind Vercel rewrites is routing convenience, not an access control boundary.

---

## 6) Storage security (audio files)

### Baseline rules

- Buckets should be **private** by default.
- Enforce access via Storage policies (`storage.objects`) aligned to our object-key conventions (user prefixing).
- For uploads:
  - do not proxy large files through Edge Functions
  - prefer signed upload URLs or resumable uploads

Also treat storage object keys stored in tables as **server-owned** values:
- If a client can write `reference_object_key` / `audio_object_key` into a row, and an Edge Function later uses a service-role client to sign that key, an attacker may be able to trick the server into signing an object they don't own.
- Mitigation: prevent clients from writing these columns directly (revoke INSERT/UPDATE or add guard triggers) and validate the expected `{user_id}/...` prefix before signing.

### Storage-specific attack vectors

Storage has the same "direct access" model as the Data API. A user with the right policy can call the Storage API directly to:

- **Upload arbitrary files** — Storage policies control *path* access, not file content. Without validation, a user could upload a 500MB file, an executable, or a file with a misleading extension. Mitigations:
  - Set **file size limits** on the bucket (Supabase dashboard or SQL).
  - Restrict **allowed MIME types** in the bucket configuration.
  - If content validation matters (e.g., "must be valid audio"), do it in an Edge Function that generates a signed upload URL only after checking preconditions.

- **Rename/move/delete files** — If the policy allows delete/update on a path, the user can remove or rename files that your database still references, orphaning records. Mitigations:
  - Keep Storage policies as narrow as possible (e.g., allow INSERT on `user_id/` path, but only allow DELETE via Edge Function).
  - If the database references a storage path, consider a **database trigger** or Edge Function that keeps both in sync on delete.

- **Enumerate paths** — If SELECT is granted broadly, users can list objects in other users' folders. Restrict SELECT policies to `auth.uid()` prefixed paths.

### Utter bucket layout and policies

Utter uses two private buckets (see `architecture.md` section 6):
- **`references`**: `{user_id}/{voice_id}.{ext}` — voice reference audio uploaded during clone
- **`generations`**: `{user_id}/{generation_id}.wav` — TTS output uploaded by Edge Functions

**`references` bucket** — client uploads via signed URL, reads own files:

```sql
-- Users can read their own reference audio
create policy "references_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'references' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Users can upload to their own folder (via signed upload URL from Edge Function)
create policy "references_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'references' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Only Edge Functions (service_role) delete reference audio — no client delete
-- (deleting a voice triggers Edge Function cleanup, not direct client storage delete)
```

**`generations` bucket** — only Edge Functions write; client reads own files:

```sql
-- Users can read their own generated audio (for signed URL generation)
create policy "generations_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'generations' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- No INSERT/UPDATE/DELETE for authenticated — Edge Functions upload via service_role
```

Note: these policies use `(select auth.uid())` (not bare `auth.uid()`) for the same initPlan caching reason as database RLS policies.

Official docs:

- Storage access control: https://supabase.com/docs/guides/storage/security/access-control

---

## 7) Auth settings and JWT handling

### Vercel domain configuration

We will have:

- Production domain(s)
- Vercel Preview Deployment domains

Supabase Auth must allow the relevant redirect URLs/origins, otherwise login flows will fail.

If we use the Vercel ↔ Supabase Marketplace integration, it can automate some redirect URL setup for preview branches (still validate the exact behavior for our flow).

### JWT security notes

Supabase Auth issues JWTs that are sent with every request. Things to get right:

- **JWTs are not secret** — they are visible to the client and can be decoded by anyone. Never put sensitive data in custom claims.
- **Token expiry matters** — the default access token lifetime is 3600s (1 hour). RLS policies check claims from the JWT, so stale tokens can grant access based on outdated data (e.g., a user whose role was changed still has the old role in their token until it expires). For sensitive role-based checks, verify against the database inside the RLS policy rather than relying solely on JWT claims.
- **In Edge Functions**, always verify the JWT from the `Authorization` header using `supabase.auth.getUser()` (which validates against the Auth server), not just `supabase.auth.getSession()` (which only decodes locally and can be spoofed). The difference matters:

  ```ts
  // WRONG: trusts the client-provided JWT without server verification
  const { data: { session } } = await supabase.auth.getSession();

  // RIGHT: validates the token against Supabase Auth
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return new Response('Unauthorized', { status: 401 });
  ```

- **`user_metadata` is not trusted** — authenticated users can modify their own `raw_user_meta_data` via `supabase.auth.updateUser()`. **Never use `user_metadata` in RLS policies or authorization checks.** Use `app_metadata` instead, which is only modifiable server-side (via service_role or the Auth admin API). This is called out in `architecture-learn.md` and in the Supabase Auth docs — it's a common source of privilege escalation.
- **Refresh tokens** — the client SDK handles refresh automatically, but be aware that a leaked refresh token grants long-lived access. Supabase supports refresh token rotation (one-time use) — ensure this is enabled.

### Realtime subscriptions

Realtime channels (Postgres Changes, Broadcast, Presence) also respect RLS, but:

- The JWT used to establish the connection determines access for the lifetime of that connection.
- If a user's permissions change, they keep their current subscription access until they reconnect.
- Apply the same RLS rigor to Realtime-exposed tables as to Data API tables.

Official docs:

- JWTs (how tokens work / verification): https://supabase.com/docs/guides/auth/jwts
- Vercel Marketplace integration (Supabase docs): https://supabase.com/docs/guides/integrations/vercel-marketplace
- Supabase on Vercel marketplace: https://vercel.com/marketplace/supabase/

---

## 8) “Backend exposed” incident pattern (what usually went wrong)

If a prior Netlify/Vercel + Supabase project felt “exposed”, the typical causes are:

- a table in an exposed schema without RLS enabled
- overly permissive RLS policies
- using the service role key in the frontend (or otherwise leaking it)

Fix is almost always:

- enable/correct RLS
- harden exposed schemas / privileges
- move privileged logic into Edge Functions

---

## 9) Pre-launch checklist

### Secrets & keys
- [ ] No `service_role` or DB secrets in frontend build env (`VITE_*`)
- [ ] Service role key only used in Edge Functions / server-side code

### RLS & column security
- [ ] RLS enabled + policies written for **all** exposed tables (`voices`, `generations`, `tasks`)
- [ ] `(select auth.uid())` pattern used in policies (not bare `auth.uid()`)
- [ ] Column-guard triggers on any table with direct client UPDATE (currently: none — but add if `voices` gets client-side UPDATE)
- [ ] `profiles`: if credits/tier live here, prevent client tampering (revoke UPDATE or add a guard trigger allowlisting only safe fields)
- [ ] `user_id` columns indexed on all RLS-filtered tables (`idx_voices_user_id`, `idx_generations_user_id`, `idx_tasks_user_id`)

### Grants & Data API
- [ ] `profiles`: UPDATE revoked from `authenticated` (server-only writes via `/api/profile` or RPC)
- [ ] `generations`: INSERT/UPDATE revoked from `authenticated` (Edge Functions only)
- [ ] `tasks`: INSERT/UPDATE/DELETE revoked from `authenticated` (Edge Functions only)
- [ ] `voices`: INSERT/UPDATE revoked from `authenticated` (unless we explicitly re-enable client-side writes with additional safeguards)
- [ ] `anon` role has no write access to any application table
- [ ] No RLS policies reference `user_metadata` (use `app_metadata` for role-based checks)
- [ ] Data API exposure reviewed: no unintended tables in exposed schemas

### Storage
- [ ] `references` and `generations` buckets are private
- [ ] Storage policies scoped to `(select auth.uid())::text` prefixed paths
- [ ] `generations` bucket: no INSERT/DELETE for `authenticated` (Edge Functions write via service_role)
- [ ] File size limits and allowed MIME types configured per bucket
- [ ] No broad SELECT policies that allow cross-user path enumeration

### Edge Functions & Auth
- [ ] Edge Functions use `getUser()` (server-verified), not `getSession()` (local decode)
- [ ] Webhooks: auth disabled but signature verification enforced
- [ ] Auth redirect URLs configured for prod + preview domains
- [ ] Refresh token rotation enabled
- [ ] Expensive endpoints have abuse controls (auth-gated, rate-limited, and credits/quotas enforced before provider calls)

### General
- [ ] Supabase "Security Advisor" clean (or findings triaged)
- [ ] Preview deployments do not point at production Supabase project

---

## Appendix: Vercel previews should not use production data

Vercel Preview Deployments are great for UI iteration, but they should not accidentally point at the production Supabase project.

Because Utter uses static `vercel.json` rewrites for `/api/*`, the simplest safe approach is:

- a staging Vercel project (rewrites → staging Supabase)
- a production Vercel project (rewrites → production Supabase)

See `docs/vercel-frontend.md`.

---

## Appendix: Sources and further reading

Community discussions that informed this guide:

- [Discussion #20074 — Data tampering, column manipulation, storage gaps](https://github.com/orgs/supabase/discussions/20074)
- [Discussion #656 — Column-level access control, trigger-based solutions](https://github.com/orgs/supabase/discussions/656)
- [supabase/agent-skills — Postgres best practices](https://github.com/supabase/agent-skills/tree/main/skills/supabase-postgres-best-practices) — good for RLS basics, RLS performance, and privilege management; does not cover column-level security, storage attack vectors, or server-side validation patterns.

Official Supabase security docs:

- [Securing your project](https://supabase.com/docs/guides/security)
- [RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Hardening the Data API](https://supabase.com/docs/guides/database/hardening-data-api)
- [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- [Edge Functions auth](https://supabase.com/docs/guides/functions/auth)
- [JWTs in Supabase](https://supabase.com/docs/guides/auth/jwts)
