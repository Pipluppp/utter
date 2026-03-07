# Plan 02: Backend Concurrency and Job Model

## Goal

Enable safe multi-job execution without regressing task/credit integrity.

## In-scope backend changes

1. Remove strict "single active generate task" guard path.
2. Replace with explicit configurable concurrency cap.
3. Keep queue-first submission and existing terminal guards.

## Implementation tasks

1. Route-level cap guard:
- Update `workers/api/src/routes/generate.ts`:
  - replace active-task existence check with count-based cap check
  - return clear `409` when cap is exceeded

2. DB constraint migration:
- Replace unique partial index `idx_tasks_generate_one_active_per_user` with non-unique support for multiple active rows.
- Optional: add supporting index for active-task counting by user/type/status.

3. Credit and idempotency invariants:
- Ensure each submitted generation keeps independent debit/refund idempotency keys.
- Verify cancellation/refund path is per-task/per-generation safe under concurrency.

4. Queue safety:
- Keep consumer terminal updates guarded (`not in completed/failed/cancelled` where required).
- Ensure replayed messages cannot corrupt already-terminal tasks.

5. Config:
- Add env var for active-generate cap (for example `MAX_ACTIVE_GENERATE_TASKS_PER_USER`).
- Set explicit defaults in local/staging/prod env docs.

## Acceptance criteria

1. Multiple generate jobs can be submitted up to cap.
2. Submissions above cap fail predictably with `409` and actionable detail.
3. Credit/refund behavior remains consistent per task.
4. Queue replay/cancel races do not violate terminal-state rules.

## Risks

1. Burst concurrency may increase queue backlog and latency.
2. Poor cap defaults may increase abuse or cost.

## Mitigation

1. Start with conservative cap and observe queue/latency metrics.
2. Couple with rate limiting and abuse detection thresholds.
