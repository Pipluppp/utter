-- Phase 08b: RLS policies on generations — SELECT/DELETE own, no INSERT/UPDATE, cross-user isolation
BEGIN;
SELECT plan(8);

-- Create two test users
INSERT INTO auth.users (id, instance_id, role, aud, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls_gen_a@test.com', crypt('pass', gen_salt('bf')), now(), now(), now(), '', '', '', ''),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls_gen_b@test.com', crypt('pass', gen_salt('bf')), now(), now(), now(), '', '', '', '');

-- Seed: User A has a generation (inserted as superuser)
INSERT INTO public.generations (id, user_id, text, status)
VALUES ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Hello world', 'completed');

-- ============================================================
-- User A context
-- ============================================================
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","aud":"authenticated"}';

-- Test 1: User A can read own generation
SELECT results_eq(
  $$SELECT count(*)::int FROM public.generations$$,
  ARRAY[1],
  'User A sees exactly 1 generation'
);

-- Test 2: User A cannot INSERT generations (grant revoked — edge-only)
SELECT throws_ok(
  $$INSERT INTO public.generations (id, user_id, text, status)
    VALUES (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test', 'pending')$$,
  '42501',
  NULL,
  'User A cannot insert generations (INSERT revoked from authenticated)'
);

-- Test 3: User A cannot UPDATE generations (grant revoked — edge-only)
SELECT throws_ok(
  $$UPDATE public.generations SET status = 'failed' WHERE id = '11111111-1111-1111-1111-111111111111'$$,
  '42501',
  NULL,
  'User A cannot update generations (UPDATE revoked from authenticated)'
);

-- Test 4: User A can delete own generation
SELECT lives_ok(
  $$DELETE FROM public.generations WHERE id = '11111111-1111-1111-1111-111111111111'$$,
  'User A can delete own generation'
);

-- Re-insert for cross-user tests
RESET role;
INSERT INTO public.generations (id, user_id, text, status)
VALUES ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Hello world', 'completed');

-- ============================================================
-- User B context
-- ============================================================
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated","aud":"authenticated"}';

-- Test 5: User B sees 0 generations
SELECT results_eq(
  $$SELECT count(*)::int FROM public.generations$$,
  ARRAY[0],
  'User B sees 0 generations (isolation works)'
);

-- Test 6: User B cannot delete User A's generation
SELECT results_eq(
  $$WITH deleted AS (
    DELETE FROM public.generations WHERE id = '11111111-1111-1111-1111-111111111111' RETURNING id
  ) SELECT count(*)::int FROM deleted$$,
  ARRAY[0],
  'User B cannot delete User A generation (0 rows affected)'
);

-- ============================================================
-- Anon context
-- ============================================================
RESET role;
SET LOCAL role = 'anon';

-- Test 7: Anon sees no generations
SELECT results_eq(
  $$SELECT count(*)::int FROM public.generations$$,
  ARRAY[0],
  'Anon sees 0 generations'
);

-- Test 8: Anon cannot delete generations
SELECT throws_ok(
  $$DELETE FROM public.generations WHERE id = '11111111-1111-1111-1111-111111111111'$$,
  '42501',
  NULL,
  'Anon cannot delete generations'
);

SELECT * FROM finish();
ROLLBACK;
