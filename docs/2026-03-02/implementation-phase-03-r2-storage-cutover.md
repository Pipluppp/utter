# Phase 03: R2 Storage Cutover

Date: 2026-03-02  
Status: Ready for implementation

## Goal

Move object storage operations from Supabase Storage to Cloudflare R2 with minimal API contract change.

## Scope

- Buckets/objects for:
  - references audio
  - generations audio
- Signed upload/download behavior
- Delete/list operations used in existing routes

## Existing storage touchpoints

Primary routes:

- `supabase/functions/api/routes/clone.ts`
- `supabase/functions/api/routes/design.ts`
- `supabase/functions/api/routes/generate.ts`
- `supabase/functions/api/routes/generations.ts`
- `supabase/functions/api/routes/tasks.ts`
- `supabase/functions/api/routes/voices.ts`

## Implementation steps

1. Introduce storage abstraction in Worker API code:
   - `StorageProvider` interface with:
     - `createSignedUploadUrl`
     - `createSignedDownloadUrl`
     - `put`
     - `remove`
     - `list`
2. Implement providers:
   - `SupabaseStorageProvider` (for fallback/rollback)
   - `R2StorageProvider` (target)
3. Add runtime flag:
   - `STORAGE_PROVIDER=supabase|hybrid|r2`
4. Preserve object-key schema:
   - `<user_id>/<entity>.wav` patterns unchanged
5. For this pre-production migration, use full R2 mode:
   - writes: R2
   - reads: R2
   - no mandatory legacy backfill
6. Keep `hybrid` mode available only as emergency fallback path, not steady-state design.

## Suggested cutover strategy

1. Start with `STORAGE_PROVIDER=r2` in staging.
2. Validate all write/read/delete/signing flows end-to-end on R2.
3. Promote to production in `r2`.
4. Use `STORAGE_PROVIDER=hybrid` only if unexpected missing-object issues are discovered.

## Validation checklist

- [ ] Clone upload URL generation works and uploaded file is usable.
- [ ] Design preview audio is retrievable.
- [ ] Generation audio playback works for all newly created rows.
- [ ] Delete voice/generation removes corresponding object.
- [ ] Signed URL expiry semantics match frontend assumptions.

## Rollback

1. Flip `STORAGE_PROVIDER=supabase`.
2. Keep Worker API runtime unchanged.
3. Re-run smoke tests for clone/design/generate/history.

## Deliverables

1. Storage adapter implementation.
2. R2 end-to-end validation report.
3. Production cutover + fallback notes (`hybrid`/`supabase` emergency modes).
