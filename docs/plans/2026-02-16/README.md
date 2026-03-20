# Deployment Focus - 2026-02-13

This folder extracts the immediate deployment work from Supabase migration phases into execution-focused tasks.

## Task sequence (locked)

1. **Deploy Supabase staging backend**  
   `./deploy-supabase/README.md`
2. **Wire Vercel frontend to staging backend**  
   `./wire-vercel-supabase/README.md`
3. **Only after 1 and 2 are complete:** start official Qwen API wiring/cutover work (replace Modal-first runtime mode as planned under `docs/qwen-integration/`).

## Source mapping

- Task 1 source: `docs/supabase-migration/phases/09-staging-deploy.md`
- Task 2 source: `docs/supabase-migration/phases/10-vercel.md`

## Why this exists

- higher visibility for "what is next now"
- one-page task context + commands + acceptance gates
- explicit dependency gate before Qwen cutover work
