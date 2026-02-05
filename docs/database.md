# Database + RLS plan (Supabase Postgres)

Last updated: **2026-02-05**

This doc defines the Postgres schema we need for a Supabase-first Utter backend:

- tables and columns (voices, generations, tasks)
- required indexes and constraints
- Row Level Security (RLS) policies
- Storage bucket access policies (`storage.objects`)
- migration workflow expectations

Related docs:
- Architecture (comprehensive reference): [`architecture.md`](./architecture.md)
- Milestones: [`milestone.md`](./milestone.md)
- Supabase grounding + workflows: [`supabase.md`](./supabase.md)
- Backend endpoint mapping: [`backend.md`](./backend.md)
- Orchestration model: [`edge-orchestration.md`](./edge-orchestration.md)

## Design goals

1) Multi-tenant by default: every row is owned by a Supabase Auth user (`user_id`).
2) RLS is the security boundary: the schema should be safe even if someone calls PostgREST directly.
3) Stateless backend: task state must be durable (`tasks` table), never in memory.
4) Storage is first-class: DB stores object keys; audio bytes live in Storage.
5) Idempotent orchestration: support poll-driven finalization safely under concurrent polling.

## Storage conventions (bucket + object key)

We will use private buckets:
- `references`
- `generations`

Recommended object key convention (user-scoped):
- bucket: `references`, object key: `<user_id>/<voice_id>/reference.wav`
- bucket: `generations`, object key: `<user_id>/<generation_id>.wav`

DB columns should store object keys (not full URLs, not local paths).

## Core tables (proposed)

This is a starting point, not final SQL. We should implement this via Supabase migrations.

### Tables (DDL sketch)

```sql
-- voices: cloned or designed voices
create table if not exists public.voices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  name text not null,
  source text not null check (source in ('uploaded', 'designed')),
  language text not null,
  description text,

  reference_path text not null,
  reference_transcript text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists voices_user_created_at
  on public.voices (user_id, created_at desc);

-- generations: generated speech outputs
create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  voice_id uuid not null references public.voices(id) on delete cascade,

  text text not null,
  language text not null,

  status text not null check (status in ('processing', 'completed', 'failed', 'cancelled')),
  audio_object_key text,

  duration_seconds real,
  generation_time_seconds real,
  error_message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists generations_user_created_at
  on public.generations (user_id, created_at desc);

create index if not exists generations_voice_created_at
  on public.generations (voice_id, created_at desc);

-- tasks: canonical async state machine
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  type text not null,
  status text not null check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),

  modal_job_id text,
  voice_id uuid references public.voices(id) on delete set null,
  generation_id uuid references public.generations(id) on delete set null,

  metadata jsonb not null default '{}'::jsonb,
  result jsonb,
  error text,

  cancellation_requested boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists tasks_user_created_at
  on public.tasks (user_id, created_at desc);

create index if not exists tasks_modal_job_id
  on public.tasks (modal_job_id);
```

### RLS (policy sketch)

Enable RLS and apply the "user owns row" rule on all three tables.

**Performance note:** Wrapping `auth.uid()` in `(select auth.uid())` triggers Postgres's `initPlan` optimization — the function is evaluated once per statement instead of once per row. This matters on tables with many rows.

```sql
alter table public.voices enable row level security;
alter table public.generations enable row level security;
alter table public.tasks enable row level security;

-- voices: users CRUD their own
create policy voices_select_own on public.voices
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy voices_insert_own on public.voices
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy voices_update_own on public.voices
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy voices_delete_own on public.voices
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- generations: users read/delete their own (insert/update via service role in edge functions)
create policy generations_select_own on public.generations
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy generations_delete_own on public.generations
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- tasks: users read their own (insert/update via service role in edge functions)
create policy tasks_select_own on public.tasks
  for select to authenticated
  using ((select auth.uid()) = user_id);
```

Notes:
- INSERT/UPDATE on `generations` and `tasks` is done by edge functions using the service role key (bypasses RLS). Users don't directly insert these — edge functions do it on their behalf after validation.
- The service role key bypasses RLS entirely; only use it for explicitly server-owned flows.
- PostgREST uses the `anon` and `authenticated` roles; policies target `authenticated`.

## Storage policies (`storage.objects`)

Storage access control is enforced by policies on `storage.objects`.

Given our object key convention (`<user_id>/...`), the intent is:
- a user can only `select/insert/update/delete` objects in bucket `references` within their own prefix
- same for bucket `generations`

Policy sketch (see official Storage access control docs for exact helpers/functions):

```sql
-- references bucket
create policy references_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'references'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy references_write_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'references'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- generations bucket
create policy generations_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id IN ('references', 'generations')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
```

Note: generation file uploads are done by edge functions using the service role key, so no INSERT policy is needed for the `generations` bucket on the `authenticated` role.

## Hardening the data API surface (recommended)

Even if we route all frontend calls through Edge Functions, PostgREST still exists.

We should follow Supabase's "hardening data API" guidance:
- expose only the schema(s) we want exposed
- avoid granting broad privileges to `anon`/`authenticated`
- consider an explicit `api` schema with views/RPC for what we want exposed

If we use views, remember:
- views can bypass RLS unless configured as "security invoker" (see Supabase RLS docs)

## Migration workflow (what we will do in git)

We will store schema changes as SQL migrations under `supabase/migrations/` and use the Supabase CLI to apply them locally and promote them across environments.

Minimum expectations:
- `supabase db reset` recreates the DB and applies all migrations (local reproducibility)
- staging is always migrated from git, never edited manually in the dashboard
- prod migrations are promoted after staging validation

## Open decisions (database-specific)

- Should `voices.name` be unique per user?
- Do we need soft-delete (`deleted_at`) for voices/generations?
- Do we store additional audio metadata (codec, sample rate, loudness) for future UX?
- Do we model design preview as a `generation` (type=preview) or as a separate table?

