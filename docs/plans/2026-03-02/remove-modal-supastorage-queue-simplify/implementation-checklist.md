# Implementation Checklist (to fill during execution)

Date opened: 2026-03-03

## Plan 01 - Remove Modal

- [x] Modal modules removed
- [x] Provider types/config simplified to qwen-only
- [x] Modal queue message types removed
- [x] Modal branches removed from generate/design/tasks
- [x] Typecheck/tests pass
- [x] Staging DB cleanup/compat handling for stale modal rows completed

## Plan 02 - R2-only storage

- [x] Supabase/hybrid branches removed from storage adapter
- [x] R2 bindings verified in target env
- [x] Local dev R2 binding mode verified
- [x] Signed upload/download smoke verified
- [x] Playback/delete/list smoke verified

## Plan 03 - Queue-first

- [x] `waitUntil` fallback removed
- [x] `/api/tasks/:id` converted to read-only task status API
- [x] Queue consumer owns finalization
- [x] Terminal/cancel guards prevent cancelled tasks being overwritten
- [x] Local dev queue binding mode verified
- [ ] DLQ and retry behavior verified

## Plan 04 - Integrated validation

- [x] Auth smoke
- [x] Clone smoke
- [x] Design smoke
- [x] Generate smoke
- [x] Credits/billing idempotency checks
- [x] Staging logs reviewed

## Plan 05 - Docs

- [x] Core docs updated
- [x] Historical docs labeled
- [x] No contradictory env/setup/deploy instructions remain

## Notes

- `npm --prefix workers/api run typecheck` and `npm --prefix workers/api run check` passed on 2026-03-03.
- `npm --prefix frontend run check` and `npm --prefix frontend run typecheck` passed on 2026-03-03.
- `npm run test:db` passed (261 tests) on 2026-03-03.
- `npm run test:worker:local` passed (126 tests) on 2026-03-03 after isolating rate-limit test IP identity and updating clone storage smoke coverage for R2-first routing.
- Staging deploys completed on 2026-03-03:
  - API: `utter-api-staging` version `d22dda56-381c-4e46-8dab-913b2fd2b170`
  - Frontend: `utter` version `966146e4-139b-4841-aaf5-f19a1b037819`
- Staging smoke checks completed (auth + clone/design/generate/tasks/credits/billing route coverage) and live Worker logs were tailed via `wrangler tail utter-api-staging`.
