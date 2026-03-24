-- Schema cleanup: remove Modal-era artifacts and unused profile vanity columns
--
-- Scope:
--   1. Migrate any remaining 'modal' provider values → 'qwen'
--   2. Drop dead columns: tasks.modal_job_id, tasks.modal_poll_count,
--      profiles.handle, profiles.display_name, profiles.avatar_url
--   3. Drop dead index: idx_tasks_modal_job_id
--   4. Drop dead function: increment_task_modal_poll_count(uuid, uuid)
--   5. Replace provider CHECK constraints to accept only 'qwen'
--   6. Update column defaults from 'modal' → 'qwen'
--
-- All DROP statements use IF EXISTS for idempotency.

-- ============================================================
-- Step 1 — Data migration: 'modal' → 'qwen'
-- ============================================================

UPDATE public.voices      SET tts_provider = 'qwen' WHERE tts_provider = 'modal';
UPDATE public.tasks        SET provider     = 'qwen' WHERE provider     = 'modal';
UPDATE public.generations  SET tts_provider = 'qwen' WHERE tts_provider = 'modal';

-- ============================================================
-- Step 2 — Drop dead columns
-- ============================================================

ALTER TABLE public.tasks    DROP COLUMN IF EXISTS modal_job_id;
ALTER TABLE public.tasks    DROP COLUMN IF EXISTS modal_poll_count;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS handle;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS display_name;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS avatar_url;

-- ============================================================
-- Step 3 — Drop dead index
-- ============================================================

DROP INDEX IF EXISTS public.idx_tasks_modal_job_id;

-- ============================================================
-- Step 4 — Drop dead function
-- ============================================================

DROP FUNCTION IF EXISTS public.increment_task_modal_poll_count(uuid, uuid);

-- ============================================================
-- Step 5 — Replace provider CHECK constraints (Qwen-only)
-- ============================================================

ALTER TABLE public.voices      DROP CONSTRAINT IF EXISTS voices_tts_provider_check;
ALTER TABLE public.voices      ADD  CONSTRAINT voices_tts_provider_check      CHECK (tts_provider IN ('qwen'));

ALTER TABLE public.tasks       DROP CONSTRAINT IF EXISTS tasks_provider_check;
ALTER TABLE public.tasks       ADD  CONSTRAINT tasks_provider_check           CHECK (provider IN ('qwen'));

ALTER TABLE public.generations DROP CONSTRAINT IF EXISTS generations_tts_provider_check;
ALTER TABLE public.generations ADD  CONSTRAINT generations_tts_provider_check CHECK (tts_provider IN ('qwen'));

-- ============================================================
-- Step 6 — Alter defaults: 'modal' → 'qwen'
-- ============================================================

ALTER TABLE public.voices      ALTER COLUMN tts_provider SET DEFAULT 'qwen';
ALTER TABLE public.tasks       ALTER COLUMN provider     SET DEFAULT 'qwen';
ALTER TABLE public.generations ALTER COLUMN tts_provider SET DEFAULT 'qwen';
