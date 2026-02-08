-- Phase 02: Initial schema + RLS + storage

-- Required for gen_random_uuid()
create extension if not exists "pgcrypto" with schema extensions;

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
  metadata jsonb not null default '{}'::jsonb, -- Flexible: text_length, language, etc.
  result jsonb,                        -- Flexible: audio_url, duration, etc.
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ============================================================
-- INDEXES
-- ============================================================

-- RLS performance: user_id indexes
create index idx_voices_user_id_created on public.voices (user_id, created_at desc);
create index idx_generations_user_id_created on public.generations (user_id, created_at desc);
create index idx_tasks_user_id on public.tasks (user_id);

-- Foreign key indexes (Postgres does NOT auto-index FKs)
create index idx_generations_voice_id on public.generations (voice_id);
create index idx_tasks_generation_id on public.tasks (generation_id);
create index idx_tasks_voice_id on public.tasks (voice_id);

-- Modal job lookup (partial: only rows with a job)
create index idx_tasks_modal_job_id on public.tasks (modal_job_id)
  where modal_job_id is not null;

-- Active tasks queue (partial: only pending/processing)
create index idx_tasks_active on public.tasks (created_at)
  where status in ('pending', 'processing');

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.voices enable row level security;
alter table public.generations enable row level security;
alter table public.tasks enable row level security;

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

-- ============================================================
-- GRANT REVOCATIONS (PostgREST surface hardening)
-- ============================================================

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

-- ============================================================
-- STORAGE
-- ============================================================

insert into storage.buckets (id, name, public) values ('references', 'references', false);
insert into storage.buckets (id, name, public) values ('generations', 'generations', false);

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

create policy "generations_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'generations'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );
