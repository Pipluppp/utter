-- ============================================================
-- 02_indexes.sql — All indexes (cumulative state after 15 migrations)
-- ============================================================
-- Excludes dropped indexes:
--   idx_tasks_modal_job_id          (dropped in schema_cleanup_modal_vanity)
--   idx_tasks_generate_one_active_per_user (dropped in drop_active_generate_guard)

-- ============================================================
-- voices
-- ============================================================

CREATE INDEX idx_voices_user_id_created
  ON public.voices (user_id, created_at DESC);

CREATE INDEX idx_voices_user_provider_created
  ON public.voices (user_id, tts_provider, created_at DESC);

CREATE INDEX idx_voices_user_active_provider_created
  ON public.voices (user_id, tts_provider, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_voices_user_favorite_created
  ON public.voices (user_id, is_favorite DESC, created_at DESC)
  WHERE deleted_at IS NULL;

-- ============================================================
-- generations
-- ============================================================

CREATE INDEX idx_generations_user_id_created
  ON public.generations (user_id, created_at DESC);

CREATE INDEX idx_generations_voice_id
  ON public.generations (voice_id);

CREATE INDEX idx_generations_user_provider_created
  ON public.generations (user_id, tts_provider, created_at DESC);

-- ============================================================
-- tasks
-- ============================================================

CREATE INDEX idx_tasks_user_id
  ON public.tasks (user_id);

CREATE INDEX idx_tasks_generation_id
  ON public.tasks (generation_id);

CREATE INDEX idx_tasks_voice_id
  ON public.tasks (voice_id);

CREATE INDEX idx_tasks_active
  ON public.tasks (created_at)
  WHERE status IN ('pending', 'processing');

CREATE INDEX idx_tasks_provider_job_id
  ON public.tasks (provider_job_id)
  WHERE provider_job_id IS NOT NULL;

-- ============================================================
-- credit_ledger
-- ============================================================

CREATE INDEX idx_credit_ledger_user_created
  ON public.credit_ledger (user_id, created_at DESC, id DESC);

CREATE INDEX idx_credit_ledger_reference
  ON public.credit_ledger (reference_type, reference_id)
  WHERE reference_id IS NOT NULL;

-- ============================================================
-- trial_consumption
-- ============================================================

CREATE INDEX idx_trial_consumption_user_created
  ON public.trial_consumption (user_id, created_at DESC, id DESC);

CREATE INDEX idx_trial_consumption_operation_reference
  ON public.trial_consumption (operation, reference_id)
  WHERE reference_id IS NOT NULL;

-- ============================================================
-- billing_events
-- ============================================================

CREATE INDEX idx_billing_events_user_created
  ON public.billing_events (user_id, created_at DESC);

-- ============================================================
-- rate_limit_counters
-- ============================================================

CREATE INDEX idx_rate_limit_counters_lookup
  ON public.rate_limit_counters (actor_type, actor_key, tier, window_seconds, window_start);

CREATE INDEX idx_rate_limit_counters_window_start
  ON public.rate_limit_counters (window_start);
