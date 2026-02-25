-- Credits trials + prepaid billing hardening
BEGIN;
SELECT plan(27);

INSERT INTO auth.users (
  id,
  instance_id,
  role,
  aud,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
VALUES (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'credits_trials_billing@test.com',
  crypt('pass', gen_salt('bf')),
  now(),
  now(),
  now(),
  '',
  '',
  '',
  ''
);

UPDATE public.profiles
SET credits_remaining = 10000,
    design_trials_remaining = 2,
    clone_trials_remaining = 2
WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

SELECT has_column('public', 'profiles', 'design_trials_remaining', 'profiles.design_trials_remaining exists');
SELECT has_column('public', 'profiles', 'clone_trials_remaining', 'profiles.clone_trials_remaining exists');
SELECT has_table('public', 'trial_consumption', 'trial_consumption table exists');
SELECT has_table('public', 'billing_events', 'billing_events table exists');
SELECT has_index('public', 'trial_consumption', 'idx_trial_consumption_user_created', 'trial_consumption user timeline index exists');
SELECT has_index('public', 'trial_consumption', 'idx_trial_consumption_operation_reference', 'trial_consumption reference lookup index exists');
SELECT has_index('public', 'billing_events', 'idx_billing_events_user_created', 'billing_events user timeline index exists');
SELECT has_index('public', 'billing_events', 'billing_events_provider_event_id_key', 'billing_events provider_event_id unique index exists');

SELECT results_eq(
  $$SELECT used_trial, duplicate, insufficient
    FROM public.trial_or_debit(
      'dddddddd-dddd-dddd-dddd-dddddddddddd',
      'design_preview',
      5000,
      'task',
      '11111111-1111-1111-1111-111111111111',
      'design-trial-1',
      '{}'::jsonb
    )$$,
  $$VALUES (true, false, false)$$,
  'trial_or_debit consumes first design trial'
);

SELECT results_eq(
  $$SELECT design_trials_remaining, credits_remaining
    FROM public.profiles
    WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'$$,
  $$VALUES (1, 10000)$$,
  'first design trial decrements counter without debiting credits'
);

SELECT results_eq(
  $$SELECT used_trial, duplicate, insufficient
    FROM public.trial_or_debit(
      'dddddddd-dddd-dddd-dddd-dddddddddddd',
      'design_preview',
      5000,
      'task',
      '22222222-2222-2222-2222-222222222222',
      'design-trial-2',
      '{}'::jsonb
    )$$,
  $$VALUES (true, false, false)$$,
  'trial_or_debit consumes second design trial'
);

SELECT results_eq(
  $$SELECT used_trial, duplicate, insufficient, balance_remaining
    FROM public.trial_or_debit(
      'dddddddd-dddd-dddd-dddd-dddddddddddd',
      'design_preview',
      5000,
      'task',
      '33333333-3333-3333-3333-333333333333',
      'design-trial-3',
      '{}'::jsonb
    )$$,
  $$VALUES (false, false, false, 5000)$$,
  'third design attempt debits credits after trials are exhausted'
);

SELECT results_eq(
  $$SELECT used_trial, duplicate, insufficient
    FROM public.trial_or_debit(
      'dddddddd-dddd-dddd-dddd-dddddddddddd',
      'clone',
      1000,
      'voice',
      '44444444-4444-4444-4444-444444444444',
      'clone-trial-1',
      '{}'::jsonb
    )$$,
  $$VALUES (true, false, false)$$,
  'clone first attempt consumes trial'
);

SELECT results_eq(
  $$SELECT used_trial, duplicate, insufficient
    FROM public.trial_or_debit(
      'dddddddd-dddd-dddd-dddd-dddddddddddd',
      'clone',
      1000,
      'voice',
      '44444444-4444-4444-4444-444444444444',
      'clone-trial-1',
      '{}'::jsonb
    )$$,
  $$VALUES (true, true, false)$$,
  'trial_or_debit retry with same key does not consume extra trial'
);

SELECT results_eq(
  $$SELECT clone_trials_remaining
    FROM public.profiles
    WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'$$,
  ARRAY[1],
  'idempotent retry does not decrement clone_trials_remaining again'
);

SELECT results_eq(
  $$SELECT restored, already_restored, trials_remaining
    FROM public.trial_restore(
      'dddddddd-dddd-dddd-dddd-dddddddddddd',
      'clone',
      'clone-trial-1',
      '{}'::jsonb
    )$$,
  $$VALUES (true, false, 2)$$,
  'trial_restore restores a consumed clone trial exactly once'
);

SELECT results_eq(
  $$SELECT restored, already_restored
    FROM public.trial_restore(
      'dddddddd-dddd-dddd-dddd-dddddddddddd',
      'clone',
      'clone-trial-1',
      '{}'::jsonb
    )$$,
  $$VALUES (false, true)$$,
  'trial_restore is idempotent on duplicate restore'
);

SELECT results_eq(
  $$SELECT applied, duplicate, insufficient
    FROM public.credit_apply_event(
      'dddddddd-dddd-dddd-dddd-dddddddddddd',
      'grant',
      'paid_purchase',
      150000,
      'billing',
      null,
      'paid-purchase-1',
      '{}'::jsonb
    )$$,
  $$VALUES (true, false, false)$$,
  'credit_apply_event accepts paid_purchase operation + billing reference_type'
);

SELECT results_eq(
  $$SELECT operation, reference_type
    FROM public.credit_ledger
    WHERE user_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
      AND idempotency_key = 'paid-purchase-1'$$,
  $$VALUES ('paid_purchase'::text, 'billing'::text)$$,
  'paid purchase ledger row persisted with billing reference type'
);

SELECT results_eq(
  $$SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'public.trial_consumption'::regclass$$,
  ARRAY[true],
  'trial_consumption has RLS enabled'
);

SELECT results_eq(
  $$SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'public.billing_events'::regclass$$,
  ARRAY[true],
  'billing_events has RLS enabled'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.trial_consumption', 'SELECT'),
  'authenticated has no SELECT on trial_consumption'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.billing_events', 'SELECT'),
  'authenticated has no SELECT on billing_events'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.trial_or_debit(uuid,text,integer,text,uuid,text,jsonb)',
    'EXECUTE'
  ),
  'authenticated has no EXECUTE on trial_or_debit'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.trial_restore(uuid,text,text,jsonb)',
    'EXECUTE'
  ),
  'authenticated has no EXECUTE on trial_restore'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.trial_or_debit(uuid,text,integer,text,uuid,text,jsonb)',
    'EXECUTE'
  ),
  'service_role has EXECUTE on trial_or_debit'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.trial_restore(uuid,text,text,jsonb)',
    'EXECUTE'
  ),
  'service_role has EXECUTE on trial_restore'
);

SELECT * FROM finish();
ROLLBACK;
