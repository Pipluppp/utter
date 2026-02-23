-- Phase 08b: Triggers + database functions
BEGIN;
SELECT plan(13);

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

-- ============================================================
-- 4. credit_apply_event + credit_usage_window_totals RPCs
-- ============================================================
SELECT results_eq(
  $$SELECT applied, duplicate, insufficient, balance_remaining
    FROM public.credit_apply_event(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'debit',
      'generate',
      10,
      'generation',
      '11111111-1111-1111-1111-111111111111',
      'trigger-test-debit-1',
      '{"reason":"test"}'::jsonb
    )$$,
  $$VALUES (true, false, false, 90)$$,
  'credit_apply_event debits credits atomically'
);

SELECT results_eq(
  $$SELECT credits_remaining FROM public.profiles WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  ARRAY[90],
  'credit_apply_event updates profiles.credits_remaining'
);

SELECT results_eq(
  $$SELECT applied, duplicate, insufficient, balance_remaining
    FROM public.credit_apply_event(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'debit',
      'generate',
      10,
      'generation',
      '11111111-1111-1111-1111-111111111111',
      'trigger-test-debit-1',
      '{"reason":"idempotency"}'::jsonb
    )$$,
  $$VALUES (false, true, false, 90)$$,
  'credit_apply_event is idempotent per user+idempotency key'
);

SELECT results_eq(
  $$SELECT applied, duplicate, insufficient, balance_remaining
    FROM public.credit_apply_event(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'debit',
      'generate',
      1000,
      'generation',
      '11111111-1111-1111-1111-111111111111',
      'trigger-test-debit-insufficient',
      '{"reason":"insufficient"}'::jsonb
    )$$,
  $$VALUES (false, false, true, 90)$$,
  'credit_apply_event reports insufficient credits without overdraft'
);

SELECT results_eq(
  $$SELECT applied, duplicate, insufficient, balance_remaining
    FROM public.credit_apply_event(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'refund',
      'generate',
      10,
      'generation',
      '11111111-1111-1111-1111-111111111111',
      'trigger-test-refund-1',
      '{"reason":"test_refund"}'::jsonb
    )$$,
  $$VALUES (true, false, false, 100)$$,
  'credit_apply_event refund restores credits'
);

SELECT results_eq(
  $$SELECT total_debited, total_credited, net_signed
    FROM public.credit_usage_window_totals('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', now() - interval '7 days')$$,
  $$VALUES (10, 10, 0)$$,
  'credit_usage_window_totals aggregates debits and credits'
);

SELECT * FROM finish();
ROLLBACK;
