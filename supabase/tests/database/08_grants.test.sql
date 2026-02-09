-- Phase 08b: Grant revocations — PostgREST surface hardening
-- Ref: supabase-security.md §4
BEGIN;
SELECT plan(12);

-- Create test user
INSERT INTO auth.users (id, instance_id, role, aud, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'grants@test.com', crypt('pass', gen_salt('bf')), now(), now(), now(), '', '', '', '');

-- Seed data as superuser
INSERT INTO public.voices (id, user_id, name, source)
VALUES ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Grant Test Voice', 'uploaded');
INSERT INTO public.generations (id, user_id, text, status)
VALUES ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test', 'completed');
INSERT INTO public.tasks (id, user_id, type, status)
VALUES ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'generate', 'completed');

-- ============================================================
-- AUTHENTICATED ROLE REVOCATIONS
-- ============================================================
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated","aud":"authenticated"}';

-- Generations: INSERT/UPDATE revoked
SELECT throws_ok(
  $$INSERT INTO public.generations (id, user_id, text) VALUES (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x')$$,
  '42501', NULL, 'authenticated: INSERT revoked on generations'
);
SELECT throws_ok(
  $$UPDATE public.generations SET status = 'failed' WHERE id = '22222222-2222-2222-2222-222222222222'$$,
  '42501', NULL, 'authenticated: UPDATE revoked on generations'
);

-- Voices: UPDATE revoked
SELECT throws_ok(
  $$UPDATE public.voices SET name = 'renamed' WHERE id = '11111111-1111-1111-1111-111111111111'$$,
  '42501', NULL, 'authenticated: UPDATE revoked on voices'
);

-- Tasks: INSERT/UPDATE/DELETE all revoked
SELECT throws_ok(
  $$INSERT INTO public.tasks (id, user_id, type) VALUES (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'generate')$$,
  '42501', NULL, 'authenticated: INSERT revoked on tasks'
);
SELECT throws_ok(
  $$UPDATE public.tasks SET status = 'failed' WHERE id = '33333333-3333-3333-3333-333333333333'$$,
  '42501', NULL, 'authenticated: UPDATE revoked on tasks'
);
SELECT throws_ok(
  $$DELETE FROM public.tasks WHERE id = '33333333-3333-3333-3333-333333333333'$$,
  '42501', NULL, 'authenticated: DELETE revoked on tasks'
);

-- ============================================================
-- ANON ROLE REVOCATIONS (all writes blocked on all tables)
-- ============================================================
RESET role;
SET LOCAL role = 'anon';

SELECT throws_ok(
  $$INSERT INTO public.profiles (id) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc')$$,
  '42501', NULL, 'anon: INSERT revoked on profiles'
);
SELECT throws_ok(
  $$INSERT INTO public.voices (id, user_id, name, source) VALUES (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x', 'uploaded')$$,
  '42501', NULL, 'anon: INSERT revoked on voices'
);
SELECT throws_ok(
  $$INSERT INTO public.generations (id, user_id, text) VALUES (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x')$$,
  '42501', NULL, 'anon: INSERT revoked on generations'
);
SELECT throws_ok(
  $$INSERT INTO public.tasks (id, user_id, type) VALUES (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'generate')$$,
  '42501', NULL, 'anon: INSERT revoked on tasks'
);
SELECT throws_ok(
  $$DELETE FROM public.voices WHERE id = '11111111-1111-1111-1111-111111111111'$$,
  '42501', NULL, 'anon: DELETE revoked on voices'
);
SELECT throws_ok(
  $$DELETE FROM public.generations WHERE id = '22222222-2222-2222-2222-222222222222'$$,
  '42501', NULL, 'anon: DELETE revoked on generations'
);

SELECT * FROM finish();
ROLLBACK;
