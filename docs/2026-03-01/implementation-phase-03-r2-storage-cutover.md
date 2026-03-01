# Phase 03: R2 Storage Cutover

Date: 2026-03-02  
Status: Implemented and staging-validated; staging currently runs in `STORAGE_PROVIDER=hybrid` for legacy-read parity

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

## Current staging compatibility mode (2026-03-02)

After frontend worker auth/playback validation on historical user data, staging surfaced 404s for legacy objects that still existed only in Supabase Storage and were not yet present in R2.

Current staging setting:

1. `STORAGE_PROVIDER=hybrid` in `workers/api/wrangler.toml` (`env.staging.vars`).
2. Behavior:
   - writes -> R2
   - reads -> try R2 first, then fallback to Supabase Storage
3. This restores playback parity for older data without forcing regeneration.

## Validation checklist

- [x] Storage adapter implemented in `workers/api/src/_shared/storage.ts` with `supabase|hybrid|r2` modes.
- [x] Storage-touching Worker routes switched to adapter-backed operations.
- [x] Worker-signed storage proxy routes added (`PUT/POST /api/storage/upload`, `GET /api/storage/download`).
- [x] Local API parity suite still passes in `STORAGE_PROVIDER=supabase` mode (`128/128`).
- [x] Clone upload URL generation works and uploaded file is usable in `STORAGE_PROVIDER=r2`.
- [x] Design preview audio is retrievable from `STORAGE_PROVIDER=r2`.
- [x] Generation audio playback works for newly created rows in `STORAGE_PROVIDER=r2`.
- [x] Delete generation removes corresponding R2 object in `STORAGE_PROVIDER=r2`.
- [x] Signed URL expiry semantics are enforced in `STORAGE_PROVIDER=r2`.

## Remaining pre-production follow-up

1. Set production R2 bucket names in `workers/api/wrangler.toml` (`env.production.r2_buckets`).
2. Set production `STORAGE_SIGNING_SECRET` before prod rollout.
3. Keep Phase 04 queue hardening as the production gate for long-running Qwen paths on Workers Free.

## Rollback

1. Flip `STORAGE_PROVIDER=supabase`.
2. Keep Worker API runtime unchanged.
3. Re-run smoke tests for clone/design/generate/history.

## Deliverables

1. Storage adapter implementation.
2. R2 end-to-end validation report.
3. Production cutover + fallback notes (`hybrid`/`supabase` emergency modes).
