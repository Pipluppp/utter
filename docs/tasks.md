# Tasks Jump Point

This is the quick launch page for the current task sequence.

## Current objective

Security hardening + legacy backend cleanup. See `docs/2026-02-22/README.md`.

## Active tasks

None currently.

## Queued

- **Qwen official API wiring/cutover**
  Path: `docs/qwen-integration/tasks/11-rollout-cutover.md`
  What it achieves: transitions TTS runtime from Modal-first toward official Qwen API.

## Completed

1. ~~**Standalone auth pages**~~ — Done 2026-02-21
   Path: `docs/2026-02-19/auth-pages/README.md`
   Shipped in `cee4676`. Dedicated `/auth` page with magic link + password modes.

2. ~~**Documentation cleanup**~~ — Done 2026-02-22
   Path: `docs/2026-02-22/docs-cleanup.md`
   Shipped in `813fce5`. Guide docs now describe the deployed Supabase/Vercel architecture.

3. ~~**Profile column guards**~~ — Done 2026-02-22
   Path: `docs/2026-02-22/profile-column-guards.md`
   Verified existing hardening (`20260212120000_profiles_voices_write_hardening.sql`) already revoked direct `profiles` UPDATE for `authenticated`.

4. ~~**CORS lockdown**~~ — Done 2026-02-22
   Path: `docs/2026-02-22/cors-lockdown.md`
   `supabase/functions/_shared/cors.ts` now uses `CORS_ALLOWED_ORIGIN` and per-request origin resolution (with local `*` fallback).

5. ~~**Remove legacy FastAPI backend**~~ — Done 2026-02-22
   Path: `docs/2026-02-22/remove-fastapi-backend.md`
   Removed tracked `backend/` application files from the repository.

6. ~~**Deploy Supabase staging backend**~~ — Done 2026-02-17
   Path: `docs/2026-02-16/deploy-supabase/README.md`
   Project: `jgmivviwockcwjkvpqra`, 5 migrations pushed, edge function deployed, hardening verified.

7. ~~**Wire Vercel frontend to staging Supabase**~~ — Done 2026-02-17
   Path: `docs/2026-02-16/wire-vercel-supabase/README.md`
   Live at `https://utter-wheat.vercel.app`. Auth, clone, and generation flows verified on production.

## Source mapping

- Deploy task source: `docs/supabase-migration/phases/09-staging-deploy.md`
- Vercel task source: `docs/supabase-migration/phases/10-vercel.md`
