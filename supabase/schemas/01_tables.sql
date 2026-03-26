-- Declarative schema: all 8 public tables.
-- Represents the cumulative state after all 15 imperative migrations.
-- No DML (INSERT/UPDATE/DELETE) — data operations stay in migrations.

-- ============================================================
-- profiles
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  subscription_tier text not null default 'free',
  credits_remaining int not null default 0,
  design_trials_remaining int not null default 0,
  clone_trials_remaining int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_design_trials_remaining_check check (design_trials_remaining between 0 and 2),
  constraint profiles_clone_trials_remaining_check check (clone_trials_remaining between 0 and 2)
);

-- ============================================================
-- voices
-- ============================================================

create table public.voices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  reference_object_key text,
  reference_transcript text,
  language text not null default 'Auto',
  source text not null check (source in ('uploaded', 'designed')),
  description text,
  tts_provider text not null default 'qwen',
  provider_voice_id text,
  provider_target_model text,
  provider_voice_kind text,
  provider_region text,
  provider_request_id text,
  provider_metadata jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  constraint voices_tts_provider_check check (tts_provider in ('qwen')),
  constraint voices_provider_voice_kind_check check (provider_voice_kind is null or provider_voice_kind in ('vc', 'vd'))
);

-- ============================================================
-- generations
-- ============================================================

create table public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  voice_id uuid references public.voices(id) on delete set null,
  text text not null,
  audio_object_key text,
  duration_seconds float,
  language text not null default 'Auto',
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  generation_time_seconds float,
  error_message text,
  tts_provider text not null default 'qwen',
  provider_model text,
  output_format text,
  provider_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint generations_tts_provider_check check (tts_provider in ('qwen'))
);

-- ============================================================
-- tasks
-- ============================================================

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('generate', 'design_preview', 'clone')),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  generation_id uuid references public.generations(id) on delete set null,
  voice_id uuid references public.voices(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  result jsonb,
  error text,
  provider text not null default 'qwen',
  provider_job_id text,
  provider_status text,
  provider_poll_count int not null default 0,
  cancellation_requested boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint tasks_provider_check check (provider in ('qwen'))
);

-- ============================================================
-- credit_ledger
-- ============================================================

create table public.credit_ledger (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_kind text not null check (event_kind in ('debit', 'refund', 'grant', 'adjustment')),
  operation text not null check (operation in ('generate', 'design_preview', 'clone', 'monthly_allocation', 'manual_adjustment', 'paid_purchase', 'paid_reversal')),
  amount integer not null check (amount > 0),
  signed_amount integer not null check (signed_amount <> 0),
  balance_after integer not null check (balance_after >= 0),
  reference_type text not null check (reference_type in ('task', 'generation', 'voice', 'profile', 'system', 'billing')),
  reference_id uuid,
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 128),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

-- ============================================================
-- trial_consumption
-- ============================================================

create table public.trial_consumption (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null check (operation in ('design_preview', 'clone')),
  reference_type text not null check (reference_type in ('task', 'voice')),
  reference_id uuid,
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 128),
  status text not null check (status in ('consumed', 'restored')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  restored_at timestamptz,
  unique (user_id, idempotency_key)
);

-- ============================================================
-- billing_events
-- ============================================================

create table public.billing_events (
  id bigserial primary key,
  provider text not null default 'stripe',
  provider_event_id text not null unique,
  event_type text not null,
  user_id uuid references auth.users(id) on delete set null,
  status text not null check (status in ('received', 'processed', 'ignored', 'failed')),
  credits_granted integer,
  ledger_id bigint references public.credit_ledger(id) on delete set null,
  error_detail text,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

-- ============================================================
-- rate_limit_counters
-- ============================================================

create table public.rate_limit_counters (
  id bigserial primary key,
  actor_type text not null check (actor_type in ('user', 'ip')),
  actor_key text not null check (char_length(actor_key) between 1 and 128),
  tier text not null check (tier in ('tier1', 'tier2', 'tier3')),
  window_seconds integer not null check (window_seconds > 0),
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (actor_type, actor_key, tier, window_seconds, window_start)
);
