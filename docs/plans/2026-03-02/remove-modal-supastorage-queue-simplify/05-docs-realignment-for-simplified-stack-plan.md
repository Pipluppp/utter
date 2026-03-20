# Plan 05: Docs Realignment for Simplified Stack

## Goal

Update docs to describe one clear architecture: Qwen + R2 + Queue-first orchestration.

## Docs to update

1. Core docs
- `README.md`
- `docs/README.md`
- `docs/architecture.md`
- `docs/backend.md`
- `docs/setup.md`
- `docs/deploy.md`
- `AGENTS.md`

2. Migration/continuation docs
- `docs/2026-03-02/README.md`
- `docs/tasks.md`

## Required documentation changes

1. Remove Modal as active provider narrative.
2. Remove `hybrid/supabase` storage mode instructions.
3. Document queue-first execution and task read-only polling semantics.
4. Update env var lists and local setup steps.
5. Mark old docs as historical where retained.

## Deliverables

1. `docs/2026-03-02/remove-modal-supastorage-queue-simplify/implementation-checklist.md` (created during execution)
2. Updated core docs merged with no contradictory setup guidance.

## Exit criteria

1. New contributor can understand runtime from a single consistent doc set.
2. No core doc suggests Modal or hybrid storage as active default.
3. Queue-first async model is clearly documented with operational notes.
