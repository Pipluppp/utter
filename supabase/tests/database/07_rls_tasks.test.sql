-- Phase 08b: RLS policies on tasks — SELECT own only, ALL writes revoked, cross-user isolation
BEGIN;
SELECT plan(6);

-- Create two test users
INSERT INTO auth.users (id, instance_id, role, aud, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls_task_a@test.com', crypt('pass', gen_salt('bf')), now(), now(), now(), '', '', '', ''),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls_task_b@test.com', crypt('pass', gen_salt('bf')), now(), now(), now(), '', '', '', '');

-- Seed: User A has a task (inserted as superuser)
INSERT INTO public.tasks (id, user_id, type, status)
VALUES ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'generate', 'processing');

-- ============================================================
-- User A context
-- ============================================================
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","aud":"authenticated"}';

-- Test 1: User A can read own task
SELECT results_eq(
  $$SELECT count(*)::int FROM public.tasks$$,
  ARRAY[1],
  'User A sees exactly 1 task'
);

-- Test 2: User A cannot INSERT tasks (all writes revoked)
SELECT throws_ok(
  $$INSERT INTO public.tasks (id, user_id, type, status)
    VALUES (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'generate', 'pending')$$,
  '42501',
  NULL,
  'User A cannot insert tasks (INSERT revoked)'
);

-- Test 3: User A cannot UPDATE tasks
SELECT throws_ok(
  $$UPDATE public.tasks SET status = 'completed' WHERE id = '11111111-1111-1111-1111-111111111111'$$,
  '42501',
  NULL,
  'User A cannot update tasks (UPDATE revoked)'
);

-- Test 4: User A cannot DELETE tasks
SELECT throws_ok(
  $$DELETE FROM public.tasks WHERE id = '11111111-1111-1111-1111-111111111111'$$,
  '42501',
  NULL,
  'User A cannot delete tasks (DELETE revoked)'
);

-- ============================================================
-- User B context
-- ============================================================
RESET role;
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated","aud":"authenticated"}';

-- Test 5: User B sees 0 tasks
SELECT results_eq(
  $$SELECT count(*)::int FROM public.tasks$$,
  ARRAY[0],
  'User B sees 0 tasks (isolation works)'
);

-- ============================================================
-- Anon context
-- ============================================================
RESET role;
SET LOCAL role = 'anon';

-- Test 6: Anon sees no tasks
SELECT results_eq(
  $$SELECT count(*)::int FROM public.tasks$$,
  ARRAY[0],
  'Anon sees 0 tasks'
);

SELECT * FROM finish();
ROLLBACK;
