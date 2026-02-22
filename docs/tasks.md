# Tasks Jump Point

This is the quick launch page for the current task sequence.

## Current objective

Standalone auth pages + Qwen API cutover. See `docs/2026-02-19/README.md`.

## Active tasks

1. **Remove legacy FastAPI backend**
   Path: `docs/2026-02-22/remove-fastapi-backend.md`
   What it achieves: deletes dead `backend/` directory and all references to FastAPI as current stack.

2. **Profile column guards**
   Path: `docs/2026-02-22/profile-column-guards.md`
   What it achieves: prevents clients from escalating credits/subscription_tier via direct PostgREST writes.

3. **CORS lockdown**
   Path: `docs/2026-02-22/cors-lockdown.md`
   What it achieves: restricts edge function CORS from `*` to the Vercel production origin.

4. **Documentation cleanup**
   Path: `docs/2026-02-22/docs-cleanup.md`
   What it achieves: updates stale docs, archives obsolete planning docs, aligns everything to deployed reality.

## Queued

- **Qwen official API wiring/cutover**
  Path: `docs/qwen-integration/tasks/11-rollout-cutover.md`
  What it achieves: transitions TTS runtime from Modal-first toward official Qwen API.

## Completed

1. ~~**Standalone auth pages**~~ — Done 2026-02-21
   Path: `docs/2026-02-19/auth-pages/README.md`
   Shipped in `cee4676`. Dedicated `/auth` page with magic link + password modes.

2. ~~**Deploy Supabase staging backend**~~ — Done 2026-02-17
   Path: `docs/2026-02-16/deploy-supabase/README.md`
   Project: `jgmivviwockcwjkvpqra`, 5 migrations pushed, edge function deployed, hardening verified.

3. ~~**Wire Vercel frontend to staging Supabase**~~ — Done 2026-02-17
   Path: `docs/2026-02-16/wire-vercel-supabase/README.md`
   Live at `https://utter-wheat.vercel.app`. Auth, clone, and generation flows verified on production.

## Source mapping

- Deploy task source: `docs/supabase-migration/phases/09-staging-deploy.md`
- Vercel task source: `docs/supabase-migration/phases/10-vercel.md`
