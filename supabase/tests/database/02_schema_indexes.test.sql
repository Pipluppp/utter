-- Phase 08b: Index validation + FK index invariant
BEGIN;
SELECT plan(10);

-- Custom indexes
SELECT has_index('public', 'voices', 'idx_voices_user_id_created', 'voices user_id+created_at index exists');
SELECT has_index('public', 'generations', 'idx_generations_user_id_created', 'generations user_id+created_at index exists');
SELECT has_index('public', 'tasks', 'idx_tasks_user_id', 'tasks user_id index exists');

-- FK indexes (Postgres does NOT auto-index FKs)
SELECT has_index('public', 'generations', 'idx_generations_voice_id', 'generations voice_id FK index exists');
SELECT has_index('public', 'tasks', 'idx_tasks_generation_id', 'tasks generation_id FK index exists');
SELECT has_index('public', 'tasks', 'idx_tasks_voice_id', 'tasks voice_id FK index exists');

-- Partial indexes
SELECT has_index('public', 'tasks', 'idx_tasks_modal_job_id', 'tasks modal_job_id partial index exists');
SELECT has_index('public', 'tasks', 'idx_tasks_active', 'tasks active partial index exists');

-- Profiles handle uniqueness
SELECT index_is_unique('public', 'profiles', 'profiles_handle_key', 'profiles.handle has unique index');

-- FK INDEX INVARIANT: no FK columns missing indexes (best practice guard)
SELECT results_eq(
  $$SELECT count(*)::int
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'f'
      AND c.conrelid::regclass::text LIKE 'public.%'
      AND NOT EXISTS (
        SELECT 1 FROM pg_index i
        WHERE i.indrelid = c.conrelid AND a.attnum = ANY(i.indkey)
      )$$,
  ARRAY[0],
  'No public FK columns are missing indexes'
);

SELECT * FROM finish();
ROLLBACK;
