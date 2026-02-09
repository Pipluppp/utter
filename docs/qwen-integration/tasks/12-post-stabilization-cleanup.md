# 12 - Post-Stabilization Cleanup

## Goal

Define strict criteria and execution plan for removing Modal-specific code and schema only after Qwen mode proves stable in production.

## In Scope

- Stabilization criteria.
- Deferred cleanup steps for code, schema, tests, and docs.
- Final deprecation process.

## Out of Scope

- Cleanup execution before stabilization gates are met.
- Non-TTS feature refactors.

## Interfaces Impacted

- Internal provider adapters.
- Task/generation schema fields that are Modal-specific.
- Documentation references across `docs/`.

## Files/Modules Expected to Change

Potential cleanup targets after approval:
- `supabase/functions/_shared/modal.ts`
- Modal adapter modules and tests.
- Modal-specific task fields usage in routes.
- Legacy docs mentioning active Modal orchestration.
- Schema migrations for deprecating `modal_*` columns (separate destructive migration).

## Step-by-Step Implementation Notes

1. Stabilization gates (must all pass first).
- Qwen mode runs in production for agreed window (for example 14-30 days).
- No Sev1/Sev2 provider incidents in final window.
- Success and latency metrics consistently within targets.
- Restoration drill remains possible but not needed in window.

2. Cleanup readiness review.
- Confirm product and operations sign-off.
- Confirm no remaining Modal-only voices requiring support.

3. Cleanup execution (separate release).
1. Remove runtime mode switch and set provider fixed to qwen.
2. Remove Modal adapter code and route branches.
3. Remove Modal-specific tests; keep qwen and generic contract tests.
4. Apply destructive DB migration to drop `modal_*` columns only after backup.
5. Update docs to remove Modal fallback references.

4. Post-cleanup validation.
- Re-run full test suite.
- Run production smoke checks.
- Confirm rollback now targets qwen-only previous tag.

## Data and Failure Modes

Failure modes:
1. Cleanup removes fallback too early.
- Mitigation: hard stabilization gate and sign-off requirement.
2. Destructive migration breaks old code paths unexpectedly.
- Mitigation: sequence code deploy before destructive migration.
3. Hidden operational dependency on Modal remains.
- Mitigation: explicit dependency inventory before cleanup.

## Validation Checks

### Preconditions

- Task 11 completed.
- Stabilization window and SLO evidence documented.
- DB backups available before destructive migration.

### Command list

```bash
npm run test:all
npm --prefix frontend run check
npm --prefix frontend run typecheck
npm --prefix frontend run build
rg -n "modal_|MODAL_" supabase/functions docs frontend/src
```

If destructive migration is approved:

```bash
npx supabase migration new remove_modal_fields_after_stabilization
npm run sb:reset
npm run test:db
```

### Expected success output/state

- No active runtime dependency on Modal remains.
- Test suite and smoke checks remain green.
- Docs reflect qwen-only architecture accurately.

### Failure signatures

- References to `MODAL_*` still required at runtime.
- Task/generation routes still expect `modal_*` columns.
- Cleanup migration breaks existing queries/tests.

## Exit Criteria

- Modal-specific code and schema are removed in a controlled, verified release.
- Qwen-only architecture is stable and documented.

## Rollback Note

Once destructive cleanup is shipped, rollback requires code + schema restore strategy, not just env flip. See `docs/qwen-integration/restoration.md`.
