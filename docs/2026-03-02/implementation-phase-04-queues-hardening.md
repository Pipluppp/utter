# Phase 04: Queues + Hardening

Date: 2026-03-02  
Status: Ready for implementation

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

- [ ] API response times improve or remain stable on heavy routes.
- [ ] Retry behavior recovers transient provider/storage failures.
- [ ] No duplicate credits effects under redelivery.
- [ ] Queue backlog is observable and operationally manageable.

## Rollback

1. Disable queue producer paths with feature flag.
2. Re-enable in-request fallback path for affected routes.

## Deliverables

1. Queue message schemas and handlers.
2. Feature flags for queue enable/disable.
3. Observability dashboard/runbook notes.
4. Free-plan operations budget report (messages/day and retries/day).
