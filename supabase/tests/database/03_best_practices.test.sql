-- Phase 08b: Supabase Postgres best practices + security doc regression guards
-- Sources: supabase-postgres-best-practices skill, docs/supabase-security.md
BEGIN;
SELECT plan(26);

-- ============================================================
-- 1. RLS ENABLED ON ALL PUBLIC TABLES (4 tests)
-- ============================================================
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.profiles'::regclass),
  'RLS enabled on profiles'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.voices'::regclass),
  'RLS enabled on voices'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.generations'::regclass),
  'RLS enabled on generations'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.tasks'::regclass),
  'RLS enabled on tasks'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.rate_limit_counters'::regclass),
  'RLS enabled on rate_limit_counters'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.credit_ledger'::regclass),
  'RLS enabled on credit_ledger'
);
SELECT ok(
  (SELECT count(*) > 0 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rate_limit_counters'),
  'rate_limit_counters has explicit RLS policy'
);
SELECT ok(
  (SELECT count(*) > 0 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'credit_ledger'),
  'credit_ledger has explicit RLS policy'
);

-- ============================================================
-- 2. RLS PERFORMANCE: (select auth.uid()) pattern (4 tests)
-- Bare auth.uid() is called per-row; (select auth.uid()) is cached — 100x faster
-- Ref: security-rls-performance.md, supabase-security.md §3
-- ============================================================
SELECT ok(
  (SELECT bool_and(
    COALESCE(qual ILIKE '%select auth.uid()%', true)
    AND COALESCE(with_check ILIKE '%select auth.uid()%', true)
  ) FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public'),
  'profiles RLS uses (select auth.uid()) pattern'
);
SELECT ok(
  (SELECT bool_and(
    COALESCE(qual ILIKE '%select auth.uid()%', true)
    AND COALESCE(with_check ILIKE '%select auth.uid()%', true)
  ) FROM pg_policies WHERE tablename = 'voices' AND schemaname = 'public'),
  'voices RLS uses (select auth.uid()) pattern'
);
SELECT ok(
  (SELECT bool_and(
    COALESCE(qual ILIKE '%select auth.uid()%', true)
    AND COALESCE(with_check ILIKE '%select auth.uid()%', true)
  ) FROM pg_policies WHERE tablename = 'generations' AND schemaname = 'public'),
  'generations RLS uses (select auth.uid()) pattern'
);
SELECT ok(
  (SELECT bool_and(
    COALESCE(qual ILIKE '%select auth.uid()%', true)
    AND COALESCE(with_check ILIKE '%select auth.uid()%', true)
  ) FROM pg_policies WHERE tablename = 'tasks' AND schemaname = 'public'),
  'tasks RLS uses (select auth.uid()) pattern'
);

-- ============================================================
-- 3. NO user_metadata IN RLS POLICIES (1 test)
-- Ref: supabase-security.md §7 — user_metadata is client-modifiable
-- ============================================================
SELECT results_eq(
  $$SELECT count(*)::int FROM pg_policies
    WHERE schemaname = 'public'
    AND (COALESCE(qual, '') LIKE '%user_meta%' OR COALESCE(with_check, '') LIKE '%user_meta%')$$,
  ARRAY[0],
  'No RLS policies reference user_metadata (client-modifiable, not trusted)'
);

-- ============================================================
-- 4. TIMESTAMP TYPE GUARD (1 test)
-- All timestamp columns must be timestamptz, never timestamp without tz
-- Ref: schema-data-types.md
-- ============================================================
SELECT results_eq(
  $$SELECT count(*)::int FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type = 'timestamp without time zone'$$,
  ARRAY[0],
  'No timestamp columns without timezone (always use timestamptz)'
);

-- ============================================================
-- 5. CHECK CONSTRAINT ENFORCEMENT (4 tests)
-- ============================================================

-- Need test users for FK constraints
INSERT INTO auth.users (id, instance_id, role, aud, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bp_a@test.com', crypt('pass', gen_salt('bf')), now(), now(), now(), '', '', '', '');

SELECT throws_ok(
  $$INSERT INTO public.voices (id, user_id, name, source)
    VALUES (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test', 'INVALID')$$,
  '23514',
  NULL,
  'voices.source rejects invalid values'
);

SELECT throws_ok(
  $$INSERT INTO public.generations (id, user_id, text, status)
    VALUES (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'hello', 'INVALID')$$,
  '23514',
  NULL,
  'generations.status rejects invalid values'
);

SELECT throws_ok(
  $$INSERT INTO public.tasks (id, user_id, type, status)
    VALUES (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'INVALID', 'pending')$$,
  '23514',
  NULL,
  'tasks.type rejects invalid values'
);

SELECT throws_ok(
  $$INSERT INTO public.tasks (id, user_id, type, status)
    VALUES (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'generate', 'INVALID')$$,
  '23514',
  NULL,
  'tasks.status rejects invalid values'
);

-- ============================================================
-- 6. FK CASCADE BEHAVIOR (3 tests)
-- ============================================================

-- Setup: create user B with voice + generation + task
INSERT INTO auth.users (id, instance_id, role, aud, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bp_b@test.com', crypt('pass', gen_salt('bf')), now(), now(), now(), '', '', '', '');

INSERT INTO public.voices (id, user_id, name, source)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Cascade Voice', 'uploaded');

INSERT INTO public.generations (id, user_id, voice_id, text, status)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'test', 'completed');

INSERT INTO public.tasks (id, user_id, type, status, generation_id, voice_id)
VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'generate', 'completed', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-cccc-cccc-cccc-cccccccccccc');

-- Test FK SET NULL: delete voice → generation.voice_id and task.voice_id = NULL
DELETE FROM public.voices WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

SELECT results_eq(
  $$SELECT voice_id FROM public.generations WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'$$,
  $$VALUES (NULL::uuid)$$,
  'Deleting voice sets generation.voice_id to NULL'
);

-- Test FK SET NULL: delete generation → task.generation_id = NULL
DELETE FROM public.generations WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

SELECT results_eq(
  $$SELECT generation_id FROM public.tasks WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'$$,
  $$VALUES (NULL::uuid)$$,
  'Deleting generation sets task.generation_id to NULL'
);

-- Test FK CASCADE: delete user → all child records gone
DELETE FROM auth.users WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

SELECT results_eq(
  $$SELECT count(*)::int FROM public.tasks WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'$$,
  ARRAY[0],
  'Deleting user cascades to tasks'
);

-- ============================================================
-- 7. FUNCTION SECURITY AUDIT (2 tests)
-- Ref: supabase-security.md §5b
-- ============================================================
SELECT ok(
  (SELECT prosecdef FROM pg_proc WHERE proname = 'handle_new_user' AND pronamespace = 'public'::regnamespace),
  'handle_new_user is SECURITY DEFINER'
);

SELECT ok(
  (SELECT prosecdef FROM pg_proc WHERE proname = 'increment_task_modal_poll_count' AND pronamespace = 'public'::regnamespace),
  'increment_task_modal_poll_count is SECURITY DEFINER'
);

-- ============================================================
-- 8. LEAST PRIVILEGE GUARDS (2 tests)
-- Ref: security-privileges.md, supabase-security.md §4
-- ============================================================
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.profiles', 'UPDATE'),
  'authenticated does not have UPDATE on profiles'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.voices', 'INSERT'),
  'authenticated does not have INSERT on voices'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.credit_ledger', 'INSERT'),
  'authenticated does not have INSERT on credit_ledger'
);

SELECT * FROM finish();
ROLLBACK;
