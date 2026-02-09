-- Phase 08b: Triggers + database functions
BEGIN;
SELECT plan(7);

-- ============================================================
-- 1. handle_new_user trigger: auto-creates profile on auth.users insert
-- ============================================================
INSERT INTO auth.users (id, instance_id, role, aud, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'trigger@test.com', crypt('pass', gen_salt('bf')), now(), now(), now(), '', '', '', '');

SELECT results_eq(
  $$SELECT count(*)::int FROM public.profiles WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  ARRAY[1],
  'handle_new_user trigger auto-creates profile on auth.users insert'
);

SELECT results_eq(
  $$SELECT subscription_tier FROM public.profiles WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  ARRAY['free'::text],
  'Auto-created profile has default subscription_tier=free'
);

SELECT results_eq(
  $$SELECT credits_remaining FROM public.profiles WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  ARRAY[100],
  'Auto-created profile has default credits_remaining=100'
);

-- ============================================================
-- 2. handle_updated_at trigger: updates timestamp on row change
-- ============================================================

-- Verify trigger exists on profiles
SELECT has_trigger('public', 'profiles', 'set_updated_at', 'profiles has set_updated_at trigger');

-- Verify trigger overwrites updated_at to now() even if we try to set a custom value
-- (the trigger fires BEFORE UPDATE, so our manual value gets replaced)
UPDATE public.profiles SET display_name = 'Trigger Test', updated_at = '2020-01-01T00:00:00Z'
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

SELECT results_eq(
  $$SELECT (updated_at = now()) FROM public.profiles WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  ARRAY[true],
  'handle_updated_at trigger forces updated_at = now() regardless of input'
);

-- ============================================================
-- 3. increment_task_modal_poll_count: RPC function
-- ============================================================
INSERT INTO public.tasks (id, user_id, type, status, modal_poll_count)
VALUES ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'generate', 'processing', 0);

-- Test increment returns new count
SELECT results_eq(
  $$SELECT public.increment_task_modal_poll_count('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  ARRAY[1],
  'increment_task_modal_poll_count returns 1 after first call'
);

SELECT results_eq(
  $$SELECT public.increment_task_modal_poll_count('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  ARRAY[2],
  'increment_task_modal_poll_count returns 2 after second call'
);

SELECT * FROM finish();
ROLLBACK;
