-- Phase 08b: Storage bucket existence, privacy, and policy validation
-- Ref: supabase-security.md §6
BEGIN;
SELECT plan(6);

-- Test 1: references bucket exists and is private
SELECT results_eq(
  $$SELECT count(*)::int FROM storage.buckets WHERE id = 'references' AND public = false$$,
  ARRAY[1],
  'references bucket exists and is private'
);

-- Test 2: generations bucket exists and is private
SELECT results_eq(
  $$SELECT count(*)::int FROM storage.buckets WHERE id = 'generations' AND public = false$$,
  ARRAY[1],
  'generations bucket exists and is private'
);

-- Test 3: references bucket has SELECT policy for authenticated
SELECT results_eq(
  $$SELECT count(*)::int FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'references_select_own'$$,
  ARRAY[1],
  'references_select_own storage policy exists'
);

-- Test 4: references bucket has INSERT policy for authenticated
SELECT results_eq(
  $$SELECT count(*)::int FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'references_insert_own'$$,
  ARRAY[1],
  'references_insert_own storage policy exists'
);

-- Test 5: generations bucket has SELECT policy for authenticated
SELECT results_eq(
  $$SELECT count(*)::int FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'generations_select_own'$$,
  ARRAY[1],
  'generations_select_own storage policy exists'
);

-- Test 6: Storage policies use (select auth.uid()) pattern for caching
SELECT ok(
  (SELECT bool_and(
    COALESCE(qual ILIKE '%select auth.uid()%', true)
    AND COALESCE(with_check ILIKE '%select auth.uid()%', true)
  ) FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname LIKE '%_own'),
  'Storage policies use (select auth.uid()) pattern for performance'
);

SELECT * FROM finish();
ROLLBACK;
