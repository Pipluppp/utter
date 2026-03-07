# Plan 03: Queue-First Orchestration Simplification

## Goal

Make queue processing the single async execution path for generate/design-preview, and keep `GET /api/tasks/:id` read-only.

## Current complexity to remove

1. Mixed execution model:
- queue enqueue path
- `waitUntil` fallback path
- inline poll/finalize side effects in `GET /tasks/:id`

2. Multiple feature toggles around queue behavior.

## In-scope code targets

1. Queue message and consumer:
- `workers/api/src/queues/messages.ts`
- `workers/api/src/queues/consumer.ts`
- `workers/api/src/queues/producer.ts`

2. Routes:
- `workers/api/src/routes/generate.ts`
- `workers/api/src/routes/design.ts`
- `workers/api/src/routes/tasks.ts`
- `workers/api/src/index.ts`

3. Config:
- `workers/api/wrangler.toml`
- `workers/api/src/env.ts`
- `workers/api/.dev.vars.example`

## Implementation steps

1. Remove `waitUntil` fallback for generate/design preview processing.
2. Enforce queue binding presence for async submit endpoints.
3. On enqueue failure, return explicit server error (no silent background fallback).
4. Refactor `/api/tasks/:id`:
- return DB status/result only
- no provider polling, no side-effect finalization
5. Move any remaining finalize logic into queue consumer handlers.
6. Keep idempotent updates and refunds in consumer path.
7. Add terminal/cancellation guards in consumer update queries so cancelled tasks cannot be overwritten back to completed.
8. Define local-dev queue binding strategy (top-level local queue binding vs `wrangler dev --env staging` local simulation) and update scripts/docs accordingly.

## Acceptance criteria

1. Async submit routes only enqueue work.
2. Queue consumer exclusively handles processing + finalization.
3. `GET /tasks/:id` performs no external provider calls and no writes.
4. Cancel route still updates state and refund behavior correctly.
5. DLQ/ retry behavior remains observable and documented.
6. Local dev async submit routes work with the documented queue binding mode.

## Risks

1. Queue outage impacts all async flows.

## Mitigation

1. Add explicit operational runbook for queue downtime (incident mode).
2. Verify DLQ replay command path before production.
