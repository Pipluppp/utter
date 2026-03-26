-- Drop legacy storage policies (R2 is the sole storage backend)
-- Wrapped in DO block: skipped when Supabase Storage is disabled.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'objects') then
    drop policy if exists "references_select_own" on storage.objects;
    drop policy if exists "references_insert_own" on storage.objects;
    drop policy if exists "generations_select_own" on storage.objects;
  end if;
end $$;
