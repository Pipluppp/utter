# Plan 02: Remove Supabase/Hybrid Storage Modes (R2-Only)

## Goal

Simplify storage to one mode (`r2`) and remove Supabase/Hybrid fallback branches.

## Current complexity to remove

1. `STORAGE_PROVIDER=supabase|hybrid|r2` runtime branches
2. Supabase storage adapter implementations in Worker runtime
3. Hybrid fallback checks (R2 head then Supabase read)
4. Supabase cleanup best-effort removal logic

## In-scope code targets

1. Main storage adapter:
- `workers/api/src/_shared/storage.ts`

2. Config typing/vars:
- `workers/api/src/env.ts`
- `workers/api/wrangler.toml`
- `workers/api/.dev.vars.example`

3. Route consumers (verification only):
- `workers/api/src/routes/clone.ts`
- `workers/api/src/routes/design.ts`
- `workers/api/src/routes/generate.ts`
- `workers/api/src/routes/generations.ts`
- `workers/api/src/routes/tasks.ts`
- `workers/api/src/routes/voices.ts`

## Implementation steps

1. Replace storage mode resolver with fixed `r2` behavior.
2. Remove all Supabase storage helper functions from `storage.ts`.
3. Keep signed upload/download Worker token flow unchanged.
4. Ensure R2 binding requirement errors are explicit and fail-fast.
5. Remove `STORAGE_PROVIDER` env branching; default and envs become R2-only.
6. Optional: retain a temporary emergency `supabase` branch behind a hard-disabled flag only if you want one-release rollback.
7. Update Wrangler/local-dev strategy for non-inheritable binding keys:
- either define top-level/local R2 bindings for `wrangler dev`,
- or run `wrangler dev --env staging` with local simulation (no `--remote` for queue-backed paths).

## Acceptance criteria

1. `storage.ts` contains no supabase/hybrid code paths.
2. Object upload/download/list/remove for references and generations works in staging.
3. Signed token upload/download endpoints still enforce expiry/signature/action.
4. No docs or runbooks instruct setting `STORAGE_PROVIDER=hybrid|supabase`.
5. Local dev path for R2-backed storage is documented and reproducible.

## Risks

1. Any object not in R2 becomes unavailable.

## Mitigation

1. Since data is test-only, perform controlled bucket reset/validation and accept cutover.
2. Run clone/design/generate/playback/delete smoke suite after cutover.
