# Tasks Jump Point

This is the quick launch page for the current deployment sequence.

## Current objective

Move from local Supabase runtime to a live staging project, then wire the deployed Vercel frontend to that backend safely.

## Ordered tasks

1. **Deploy Supabase staging backend**
Path: `docs/2026-02-13/deploy-supabase/README.md`  
What it achieves: creates/links staging project, pushes migrations, deploys edge API, validates security hardening and smoke flows.

2. **Wire Vercel frontend to staging Supabase**
Path: `docs/2026-02-13/wire-vercel-supabase/README.md`  
What it achieves: adds `/api/*` rewrite + env wiring so deployed frontend talks to staging Supabase edge API.

3. **Only after 1 and 2: official Qwen API wiring/cutover**
Path: `docs/qwen-integration/tasks/11-rollout-cutover.md`  
What it achieves: transitions runtime path from Modal-first toward official Qwen integration/cutover plan.

## Source mapping

- Task 1 source phase: `docs/supabase-migration/phases/09-staging-deploy.md`
- Task 2 source phase: `docs/supabase-migration/phases/10-vercel.md`
