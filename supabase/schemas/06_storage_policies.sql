-- ============================================================
-- LEGACY STORAGE POLICIES (storage.objects)
-- ============================================================
--
-- These policies are LEGACY ARTIFACTS from before the Cloudflare R2
-- migration. The runtime exclusively uses R2 for object storage;
-- Supabase Storage is NOT used by application code.
--
-- These policies exist in Postgres and must be represented here
-- for `supabase db diff` to produce an empty result. Do NOT add
-- new storage policies — all new object storage goes through R2.
--
-- When these policies are eventually dropped via migration, remove
-- the corresponding statements here and run `supabase db diff -f <name>`.
--
-- No DML here: `INSERT INTO storage.buckets` stays in migrations.
-- ============================================================

-- References bucket: authenticated users can read their own files
create policy "references_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'references'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

-- References bucket: authenticated users can upload their own files
create policy "references_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'references'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

-- Generations bucket: authenticated users can read their own files
create policy "generations_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'generations'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );
