# Phase 02 — Schema + RLS + Storage

> **Status**: Not Started
> **Prerequisites**: [Phase 01](./01-init-scaffold-proxy.md) complete
> **Goal**: Create the full Postgres schema, RLS policies, storage buckets, and triggers via SQL migrations. After this phase, the database is production-ready in structure.

---

## Why this phase exists

Everything in Phases 03-06 reads from or writes to these tables. Getting the schema right first (with RLS, indexes, and grants) means every subsequent endpoint automatically gets security and performance for free.

---

## Steps

### 1. Create the migration file

- [ ] Run:
  ```bash
  npx supabase migration new initial_schema
  ```
- [ ] This creates `supabase/migrations/<timestamp>_initial_schema.sql`
- [ ] Open the file — it will be empty. We'll populate it next.

### 2. Add tables

- [ ] Add the following SQL to the migration file:

```sql
-- ============================================================
-- TABLES
-- ============================================================

-- Profiles (extends auth.users with app-specific fields)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique,
  display_name text,
  avatar_url text,
  subscription_tier text not null default 'free',
  credits_remaining int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Voices (cloned or designed)
create table public.voices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  reference_object_key text,           -- Storage path: references/{user_id}/{voice_id}/reference.wav
  reference_transcript text,
  language text not null default 'Auto',
  source text not null check (source in ('uploaded', 'designed')),
  description text,
  created_at timestamptz not null default now()
);

-- Generations (TTS outputs)
create table public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  voice_id uuid references public.voices(id) on delete set null,
  text text not null,
  audio_object_key text,               -- Storage path: generations/{user_id}/{generation_id}.wav
  duration_seconds float,
  language text not null default 'Auto',
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  generation_time_seconds float,       -- Computed: completed_at - created_at
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Tasks (tracks async Modal jobs)
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('generate', 'design_preview', 'clone')),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  modal_job_id text,                   -- Modal job identifier
  generation_id uuid references public.generations(id) on delete set null,
  voice_id uuid references public.voices(id) on delete set null,
  modal_poll_count int not null default 0,
  metadata jsonb default '{}',         -- Flexible: text_length, language, etc.
  result jsonb,                        -- Flexible: audio_url, duration, etc.
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
```

**Schema design notes**:
- All identifiers are **lowercase snake_case** (Postgres best practice — no quoted identifiers needed)
- All timestamps use **`timestamptz`** (timezone-aware, stores UTC offset)
- **`uuid` primary keys** via `gen_random_uuid()` — acceptable at our scale. UUIDv7 (time-ordered) is an optimization for high-insert tables, not needed yet.
- **CHECK constraints** on `status` and `source` — database-level domain validation
- **JSONB** for `tasks.metadata` and `tasks.result` — heterogeneous data, no need to index inside
- `voice_id` in generations uses `ON DELETE SET NULL` — deleting a voice doesn't delete its generations, just orphans them
- `generation_time_seconds` is computed during finalization, not by a DB trigger

### 3. Add indexes

- [ ] Add to the migration:

```sql
-- ============================================================
-- INDEXES
-- ============================================================

-- RLS performance: user_id indexes
-- CRITICAL: Without these, RLS policy checks do full table scans.
-- (select auth.uid()) = user_id needs an index on user_id.
-- Composite (user_id, created_at DESC) serves both RLS filter AND default sort.
create index idx_voices_user_id_created on public.voices (user_id, created_at desc);
create index idx_generations_user_id_created on public.generations (user_id, created_at desc);
create index idx_tasks_user_id on public.tasks (user_id);

-- Foreign key indexes (Postgres does NOT auto-index FKs)
-- Required for JOIN performance and ON DELETE CASCADE/SET NULL operations.
create index idx_generations_voice_id on public.generations (voice_id);
create index idx_tasks_generation_id on public.tasks (generation_id);
create index idx_tasks_voice_id on public.tasks (voice_id);

-- Modal job lookup (partial: only rows with a job)
create index idx_tasks_modal_job_id on public.tasks (modal_job_id)
  where modal_job_id is not null;

-- Active tasks queue (partial: only pending/processing)
create index idx_tasks_active on public.tasks (created_at)
  where status in ('pending', 'processing');
```

**Index design notes**:
- **Composite indexes**: equality column first (`user_id`), range column second (`created_at DESC`)
- **Partial indexes**: only index rows that matter — `modal_job_id IS NOT NULL` and `status IN ('pending', 'processing')` are much smaller than full-table indexes
- **FK indexes**: Postgres does not auto-create these. Without them, `ON DELETE CASCADE` on `auth.users` would do a sequential scan of every table.

### 4. Add RLS policies

- [ ] Add to the migration:

```sql
-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.voices enable row level security;
alter table public.generations enable row level security;
alter table public.tasks enable row level security;

-- PERFORMANCE: (select auth.uid()) is evaluated ONCE per statement (initPlan).
-- Bare auth.uid() is evaluated PER ROW — 100x slower on large tables.

-- Profiles: read + update own
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Voices: read + insert + delete own (no client UPDATE — edge only)
create policy "voices_select_own" on public.voices
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "voices_insert_own" on public.voices
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "voices_delete_own" on public.voices
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Generations: read + delete own (inserts/updates are edge-only via service role)
create policy "generations_select_own" on public.generations
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "generations_delete_own" on public.generations
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Tasks: read own only (ALL writes are edge-only via service role)
create policy "tasks_select_own" on public.tasks
  for select to authenticated
  using ((select auth.uid()) = user_id);
```

**RLS design notes**:
- **No `for all` policies** — each operation is explicit. This prevents accidental permission grants.
- **Generations**: no INSERT/UPDATE for authenticated role. Edge Functions create and update generations using service role.
- **Tasks**: read only. The frontend never writes tasks directly — it calls `/api/generate` or `/api/tasks/:id/cancel`, and the Edge Function handles the DB write.

### 5. Add grant revocations (Data API hardening)

- [ ] Add to the migration:

```sql
-- ============================================================
-- GRANT REVOCATIONS (PostgREST surface hardening)
-- ============================================================

-- Even with RLS, the authenticated role has implicit table-level grants
-- via Supabase defaults. Revoke write access on tables that should be
-- edge-only to make PostgREST a read-only surface for these tables.

-- Generations: edge-only writes
revoke insert, update on public.generations from authenticated;

-- Tasks: edge-only everything (reads via RLS SELECT policy only)
revoke insert, update, delete on public.tasks from authenticated;

-- Voices: no client-side UPDATE (renames go through edge function later)
revoke update on public.voices from authenticated;

-- Anon role: no writes on anything
revoke insert, update, delete on public.profiles from anon;
revoke insert, update, delete on public.voices from anon;
revoke insert, update, delete on public.generations from anon;
revoke insert, update, delete on public.tasks from anon;
```

**Why this matters**: Without these revocations, anyone with a valid JWT could INSERT into `tasks` or `generations` directly via PostgREST (`supabase.from('tasks').insert(...)`) — bypassing all Edge Function validation. The RLS policies only control which rows, not which operations.

### 6. Add triggers

- [ ] Add to the migration:

```sql
-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update updated_at on row changes
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.tasks
  for each row execute function public.handle_updated_at();

-- Auto-create profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = '';

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
```

**Why `security definer` on `handle_new_user`**: This trigger runs during signup, when the user doesn't have an authenticated session yet. `security definer` makes it run as the function owner (postgres), which can INSERT into `profiles` regardless of RLS.

**Why `set search_path = ''`**: Security best practice for `security definer` functions — prevents search path injection attacks.

### 7. Add Storage buckets and policies

- [ ] Add to the migration:

```sql
-- ============================================================
-- STORAGE
-- ============================================================

-- Create private buckets
insert into storage.buckets (id, name, public) values ('references', 'references', false);
insert into storage.buckets (id, name, public) values ('generations', 'generations', false);

-- References: users can read and upload their own
-- Object keys are: {user_id}/{voice_id}/reference.wav
-- storage.foldername(name) extracts path segments, [1] is the first folder = user_id
create policy "references_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'references'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "references_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'references'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

-- Generations: users can read their own (writes are edge-only via service role)
-- Object keys are: {user_id}/{generation_id}.wav
create policy "generations_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'generations'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );
```

**Storage key scheme**:
- `references/{user_id}/{voice_id}/reference.wav` — voice reference audio
- `generations/{user_id}/{generation_id}.wav` — generated speech audio

**Why user-prefixed keys**: Enables simple "read own objects" policies. Also makes cleanup, audits, and incident response straightforward.

### 8. Apply the migration

- [ ] Run:
  ```bash
  npm run sb:reset
  ```
- [ ] This drops and recreates the database from all migrations + runs `seed.sql`
- [ ] Should complete without errors

### 9. Verify via Studio

- [ ] Open `http://localhost:54323` (Supabase Studio)
- [ ] Navigate to Table Editor → verify all 4 tables exist: `profiles`, `voices`, `generations`, `tasks`
- [ ] Check each table has the expected columns and constraints
- [ ] Navigate to Authentication → Policies → verify RLS policies are listed for each table
- [ ] Navigate to Storage → verify `references` and `generations` buckets exist and are private

### 10. Test RLS isolation

- [ ] Open SQL Editor in Studio
- [ ] Run as service role (default in Studio):
  ```sql
  -- This bypasses RLS, should work
  INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'test@test.com');
  SELECT * FROM profiles; -- Should see the auto-created profile
  ```
- [ ] Verify the `handle_new_user` trigger created a `profiles` row

---

## Files created

| File | Purpose |
|------|---------|
| `supabase/migrations/<timestamp>_initial_schema.sql` | Tables, indexes, RLS, grants, triggers, storage |

## Files modified

None.

---

## Acceptance criteria

- [ ] `npm run sb:reset` completes without SQL errors
- [ ] All 4 tables exist with correct columns and constraints
- [ ] RLS is enabled on all 4 tables (verify in Studio → Policies)
- [ ] Storage buckets `references` and `generations` exist and are private
- [ ] Signing up a user auto-creates a `profiles` row (trigger works)
- [ ] `authenticated` role cannot INSERT into `tasks` or `generations` via PostgREST

---

## Gotchas

- **`sb:reset` wipes data**: Every reset drops and recreates. This is expected. Use `seed.sql` for repeatable test data (Phase 03).
- **Storage bucket creation in migrations**: The `INSERT INTO storage.buckets` approach works locally. In production, buckets can also be created via the dashboard.
- **`storage.foldername()` returns an array**: Index `[1]` is the first path segment. For `user123/voice456/reference.wav`, `[1]` = `user123`.
- **Grant revocations are Supabase-specific**: In a vanilla Postgres setup you'd manage roles differently. Supabase pre-grants `authenticated` and `anon` roles broadly, so we revoke what we don't want.
