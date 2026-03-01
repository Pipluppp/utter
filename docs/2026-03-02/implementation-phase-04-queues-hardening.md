# Phase 04: Queues + Hardening

Date: 2026-03-02  
Status: Q1 implemented and validated in staging for qwen queues; hardening evidence captured; modal queue paths are de-scoped from active rollout

Detailed design reference:
- [cloudflare-queues-migration-plan.md](./cloudflare-queues-migration-plan.md)

## Goal

Reduce API latency and failure risk by offloading selected background operations and improving observability.

## Why this phase

Current routes rely on background async work (for example `waitUntil` flows in generate/design/tasks). Cloudflare Queues provides retryable async handling and better operational isolation.

## Candidate queue workloads

1. Qwen generation finalization pipeline
2. Design preview async processing
3. Non-critical post-processing and cleanup retries
4. Optional: modal status/finalization rechecks (remove provider polling from `GET /tasks/:id`)

## Implementation tasks

1. Create queue bindings in Worker config:
   - producer in API worker
   - consumer worker handler
2. Define message contracts:
   - `task_id`
   - `user_id`
   - operation type
   - idempotency key/reference
3. Move selected `waitUntil` codepaths to enqueue + consumer execution.
4. Ensure consumer handlers are idempotent:
   - repeated delivery must not double-debit or double-refund.
5. Add structured logs:
   - request id
   - task id
   - provider status
   - retry count
6. Add dead-letter/retry policy notes (as supported by configured queue plan).
7. Track daily queue operation usage against free-plan limits before broadening scope.

## Validation checklist

- [x] Q1 queue resources created and wired (`tts-jobs-staging`, `tts-jobs-dlq-staging`).
- [x] Staging Worker configured with queue producer + consumer bindings.
- [x] Qwen `POST /generate` and `POST /voices/design/preview` enqueue paths implemented behind feature flags.
- [x] Queue consumer executes qwen design preview message end-to-end in staging (pending -> terminal).
- [x] Queue topology is observable via Wrangler (`queues info` shows producer/consumer bindings).
- [x] Modal design preview queue path executes in staging (`design_preview.modal.start`) and no longer requires `GET /api/tasks/:id` to start work.
- [x] Modal generate queue recheck path executes in staging (`generate.modal.check`) without `GET /api/tasks/:id` side effects.
- [x] Retry behavior recovers transient provider/storage failures.
- [x] No duplicate credits effects under redelivery.
- [x] API response time comparison report for heavy routes.

## Rollback

1. Disable queue producer paths with feature flag.
2. Re-enable in-request fallback path for affected routes.

## Q1 implementation notes

Implemented in `workers/api`:

1. Message schema + type guards:
   - `workers/api/src/queues/messages.ts`
2. Producer helper:
   - `workers/api/src/queues/producer.ts`
3. Consumer dispatcher:
   - `workers/api/src/queues/consumer.ts`
4. Qwen route enqueue integration:
   - `workers/api/src/routes/generate.ts`
   - `workers/api/src/routes/design.ts`
5. Worker queue event wiring:
   - `workers/api/src/index.ts`
6. Config/env updates:
   - `workers/api/wrangler.toml`
   - `workers/api/src/env.ts`
   - `workers/api/.dev.vars.example`

## Q2 progress notes (2026-03-02)

Note: modal queue handlers remain available in code but are not part of the current rollout plan and should stay disabled by feature flags unless explicitly re-approved.

Implemented in `workers/api`:

1. Modal queue message contracts:
   - `generate.modal.check`
   - `design_preview.modal.start`
2. Queue consumer handling for modal messages:
   - `workers/api/src/queues/consumer.ts`
3. Queue-owned modal task processors:
   - `workers/api/src/routes/tasks.ts`
4. Producer enqueue integration for modal paths:
   - `workers/api/src/routes/generate.ts`
   - `workers/api/src/routes/design.ts`
5. `GET /api/tasks/:id` queue-owned read-only guard:
   - if modal task is non-terminal with `provider_status="provider_queued"` and `QUEUE_MODAL_RECHECK_ENABLED=true`, handler returns DB state without provider polling side effects.

Hardening evidence captured:

1. Retry classification implemented in queue consumer (`retry` vs terminal `ack`) with reason-coded logs.
2. Duplicate-delivery/idempotency evidence captured for credits + billing event constraints.
3. Heavy-route latency/error comparison captured against Supabase baseline on staging.

Current Qwen runtime limits (staging/prod Worker vars):

1. `QWEN_MAX_TEXT_CHARS=100` to cap generation burn while queue rollout stabilizes.

## Deliverables

1. Queue message schemas and handlers.
2. Feature flags for queue enable/disable.
3. Observability dashboard/runbook notes.
4. Free-plan operations budget report (messages/day and retries/day).
