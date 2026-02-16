# Tasks Jump Point

This is the quick launch page for the current task sequence.

## Current objective

Standalone auth pages + Qwen API cutover. See `docs/2026-02-19/README.md`.

## Active tasks

1. **Standalone auth pages** (`/login`, `/signup`)
   Path: `docs/2026-02-19/auth-pages/README.md`
   What it achieves: replaces the account-sidebar auth with dedicated, streamlined login and signup pages.

2. **Qwen official API wiring/cutover**
   Path: `docs/qwen-integration/tasks/11-rollout-cutover.md`
   What it achieves: transitions TTS runtime from Modal-first toward official Qwen API.

## Completed

1. ~~**Deploy Supabase staging backend**~~ — Done 2026-02-17
   Path: `docs/2026-02-13/deploy-supabase/README.md`
   Project: `jgmivviwockcwjkvpqra`, 5 migrations pushed, edge function deployed, hardening verified.

2. ~~**Wire Vercel frontend to staging Supabase**~~ — Done 2026-02-17
   Path: `docs/2026-02-13/wire-vercel-supabase/README.md`
   Live at `https://utter-wheat.vercel.app`. Auth, clone, and generation flows verified on production.

## Source mapping

- Deploy task source: `docs/supabase-migration/phases/09-staging-deploy.md`
- Vercel task source: `docs/supabase-migration/phases/10-vercel.md`
