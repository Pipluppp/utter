-- Phase 08b: RLS policies on profiles — read-only own profile, cross-user isolation
BEGIN;
SELECT plan(8);

-- Create two test users (trigger auto-creates profiles)
INSERT INTO auth.users (id, instance_id, role, aud, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls_prof_a@test.com', crypt('pass', gen_salt('bf')), now(), now(), now(), '', '', '', ''),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls_prof_b@test.com', crypt('pass', gen_salt('bf')), now(), now(), now(), '', '', '', '');

-- ============================================================
-- User A context
-- ============================================================
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","aud":"authenticated"}';

-- Test 1: User A can read own profile
SELECT results_eq(
  $$SELECT count(*)::int FROM public.profiles$$,
  ARRAY[1],
  'User A sees exactly 1 profile (their own)'
);

-- Test 2: User A cannot update own profile (grant revoked)
SELECT throws_ok(
  $$UPDATE public.profiles SET display_name = 'User A' WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  '42501',
  NULL,
  'User A cannot update own profile (UPDATE revoked from authenticated)'
);

-- Test 3: User A cannot see User B profile
SELECT results_eq(
  $$SELECT count(*)::int FROM public.profiles WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'$$,
  ARRAY[0],
  'User A cannot see User B profile'
);

-- Test 4: User A cannot update User B profile (grant revoked)
SELECT throws_ok(
  $$UPDATE public.profiles SET display_name = 'Hacked' WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'$$,
  '42501',
  NULL,
  'User A cannot update User B profile (UPDATE revoked from authenticated)'
);

-- ============================================================
-- User B context
-- ============================================================
RESET role;
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated","aud":"authenticated"}';

-- Test 5: User B can read own profile
SELECT results_eq(
  $$SELECT count(*)::int FROM public.profiles$$,
  ARRAY[1],
  'User B sees exactly 1 profile'
);

-- Test 6: User B display_name was NOT modified by User A
SELECT results_eq(
  $$SELECT display_name FROM public.profiles WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'$$,
  $$VALUES (NULL::text)$$,
  'User B display_name was not modified by User A'
);

-- ============================================================
-- Anon context
-- ============================================================
RESET role;
SET LOCAL role = 'anon';

-- Test 7: Anon sees no profiles
SELECT results_eq(
  $$SELECT count(*)::int FROM public.profiles$$,
  ARRAY[0],
  'Anon sees 0 profiles'
);

-- Test 8: Anon cannot insert profiles
SELECT throws_ok(
  $$INSERT INTO public.profiles (id) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc')$$,
  '42501',
  NULL,
  'Anon cannot insert into profiles'
);

SELECT * FROM finish();
ROLLBACK;
