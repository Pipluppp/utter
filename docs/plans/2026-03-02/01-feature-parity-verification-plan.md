# Plan: Feature Parity Verification

## Goal

Prove the Cloudflare hybrid stack is feature-parity with the previous deployed behavior before any broad production cutover.

## Baseline references

- `../2026-03-01/feature-migration-mapping.md`
- `../2026-03-01/implementation-phase-01-02-scaffold-progress.md`
- `../2026-03-01/implementation-phase-03-r2-storage-cutover.md`
- `../2026-03-01/implementation-phase-04-queues-hardening.md`
- `../features.md` (ground truth API/feature contract)

## Scope

1. Auth/session flows
2. Voice cloning
3. Voice design preview + save
4. Generation submit/poll/cancel/retry
5. History listing/playback/delete
6. Storage upload/download/signing paths
7. Credits ledger and billing webhooks
8. Error behavior and response contract stability (`/api/*`)

## Method

1. Build a parity matrix with old-stack expected behavior and new-stack observed behavior.
2. Run scriptable API checks for deterministic routes and payloads.
3. Run manual UX checks for multi-step and media playback flows.
4. Capture evidence for each feature:
   - request/response sample
   - status codes
   - screenshot or terminal log proof
   - pass/fail and notes

## Deliverables

1. `parity-matrix.md` (new artifact under this folder)
2. `parity-test-evidence.md` (test run logs + screenshots index)
3. `parity-regressions.md` (open defects with severity)

## Exit criteria

1. No Sev-1 or Sev-2 parity gaps
2. No contract break on `/api/*` shape for frontend consumer paths
3. Storage mode behavior (`supabase|hybrid|r2`) behaves exactly as documented
4. Queue-enabled paths preserve idempotency and user-visible behavior
