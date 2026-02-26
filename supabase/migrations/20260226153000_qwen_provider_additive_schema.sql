-- Qwen dual-provider additive schema (non-destructive)

alter table public.voices
  add column if not exists tts_provider text not null default 'modal',
  add column if not exists provider_voice_id text,
  add column if not exists provider_target_model text,
  add column if not exists provider_voice_kind text,
  add column if not exists provider_region text,
  add column if not exists provider_request_id text,
  add column if not exists provider_metadata jsonb not null default '{}'::jsonb,
  add column if not exists deleted_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'voices_tts_provider_check' and conrelid = 'public.voices'::regclass
  ) then
    alter table public.voices
      add constraint voices_tts_provider_check check (tts_provider in ('modal', 'qwen'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'voices_provider_voice_kind_check' and conrelid = 'public.voices'::regclass
  ) then
    alter table public.voices
      add constraint voices_provider_voice_kind_check check (
        provider_voice_kind is null or provider_voice_kind in ('vc', 'vd')
      );
  end if;
end $$;

alter table public.tasks
  add column if not exists provider text not null default 'modal',
  add column if not exists provider_job_id text,
  add column if not exists provider_status text,
  add column if not exists provider_poll_count int not null default 0,
  add column if not exists cancellation_requested boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_provider_check' and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_provider_check check (provider in ('modal', 'qwen'));
  end if;
end $$;

alter table public.generations
  add column if not exists tts_provider text not null default 'modal',
  add column if not exists provider_model text,
  add column if not exists output_format text,
  add column if not exists provider_metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'generations_tts_provider_check' and conrelid = 'public.generations'::regclass
  ) then
    alter table public.generations
      add constraint generations_tts_provider_check check (tts_provider in ('modal', 'qwen'));
  end if;
end $$;

update public.voices set tts_provider = 'modal' where tts_provider is null;
update public.tasks set provider = 'modal' where provider is null;
update public.generations set tts_provider = 'modal' where tts_provider is null;

create index if not exists idx_voices_user_provider_created
  on public.voices (user_id, tts_provider, created_at desc);

create index if not exists idx_voices_user_active_provider_created
  on public.voices (user_id, tts_provider, created_at desc)
  where deleted_at is null;

create index if not exists idx_tasks_provider_job_id
  on public.tasks (provider_job_id)
  where provider_job_id is not null;

create index if not exists idx_generations_user_provider_created
  on public.generations (user_id, tts_provider, created_at desc);
