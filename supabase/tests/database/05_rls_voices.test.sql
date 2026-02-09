-- Phase 08b: RLS policies on voices — SELECT/INSERT/DELETE own, no UPDATE, cross-user isolation
BEGIN;
SELECT plan(10);

-- Create two test users
INSERT INTO auth.users (id, instance_id, role, aud, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls_voice_a@test.com', crypt('pass', gen_salt('bf')), now(), now(), now(), '', '', '', ''),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls_voice_b@test.com', crypt('pass', gen_salt('bf')), now(), now(), now(), '', '', '', '');

-- Seed: User A has a voice (inserted as superuser to bypass grants)
INSERT INTO public.voices (id, user_id, name, source)
VALUES ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Voice A', 'uploaded');

-- ============================================================
-- User A context
-- ============================================================
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","aud":"authenticated"}';

-- Test 1: User A can read own voice
SELECT results_eq(
  $$SELECT count(*)::int FROM public.voices$$,
  ARRAY[1],
  'User A sees exactly 1 voice'
);

-- Test 2: User A can insert own voice
SELECT lives_ok(
  $$INSERT INTO public.voices (id, user_id, name, source)
    VALUES ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Voice A2', 'designed')$$,
  'User A can insert voice with own user_id'
);

-- Test 3: User A cannot insert voice as another user
SELECT throws_ok(
  $$INSERT INTO public.voices (id, user_id, name, source)
    VALUES (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Fake', 'uploaded')$$,
  '42501',
  NULL,
  'User A cannot insert voice with User B user_id'
);

-- Test 4: User A can delete own voice
SELECT lives_ok(
  $$DELETE FROM public.voices WHERE id = '22222222-2222-2222-2222-222222222222'$$,
  'User A can delete own voice'
);

-- Test 5: User A cannot UPDATE voices (grant revoked)
SELECT throws_ok(
  $$UPDATE public.voices SET name = 'Renamed' WHERE id = '11111111-1111-1111-1111-111111111111'$$,
  '42501',
  NULL,
  'User A cannot update voices (UPDATE revoked from authenticated)'
);

-- ============================================================
-- User B context
-- ============================================================
RESET role;
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated","aud":"authenticated"}';

-- Test 6: User B sees 0 voices (can't see User A's)
SELECT results_eq(
  $$SELECT count(*)::int FROM public.voices$$,
  ARRAY[0],
  'User B sees 0 voices (isolation works)'
);

-- Test 7: User B cannot delete User A's voice
SELECT results_eq(
  $$WITH deleted AS (
    DELETE FROM public.voices WHERE id = '11111111-1111-1111-1111-111111111111' RETURNING id
  ) SELECT count(*)::int FROM deleted$$,
  ARRAY[0],
  'User B cannot delete User A voice (0 rows affected)'
);

-- ============================================================
-- Anon context
-- ============================================================
RESET role;
SET LOCAL role = 'anon';

-- Test 8: Anon sees no voices
SELECT results_eq(
  $$SELECT count(*)::int FROM public.voices$$,
  ARRAY[0],
  'Anon sees 0 voices'
);

-- Test 9: Anon cannot insert voices
SELECT throws_ok(
  $$INSERT INTO public.voices (id, user_id, name, source)
    VALUES (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Anon Voice', 'uploaded')$$,
  '42501',
  NULL,
  'Anon cannot insert voices'
);

-- Test 10: Anon cannot delete voices
SELECT throws_ok(
  $$DELETE FROM public.voices WHERE id = '11111111-1111-1111-1111-111111111111'$$,
  '42501',
  NULL,
  'Anon cannot delete voices'
);

SELECT * FROM finish();
ROLLBACK;
