# Plan 04: API Worker, Queue, and Task-Orchestration Security Tests

## Goal

Stress-test API authorization, business logic invariants, and queue-driven async behavior to prevent privilege escalation, state corruption, and abuse.

## Scope

1. All `/api/*` routes in API Worker
2. Queue producer/consumer task execution flow
3. Task cancellation/terminal-state guarantees

## Test tasks

1. Authn/authz matrix by route:
- Unauthenticated access expectations
- Authenticated same-user vs cross-user access
- Service-role-only operations remain server-side

2. Input validation and request hardening:
- Invalid IDs, malformed JSON, oversized payloads/files
- Route-specific constraints (text lengths, required fields)
- Content-type abuse and boundary cases

3. Task and queue invariants:
- `GET /api/tasks/:id` remains read-only (no writes/side effects)
- Cancelled tasks cannot transition back to completed
- Duplicate/replayed queue messages do not create inconsistent state
- Idempotency behavior for generate/design/clone operations

4. Rate limiting and abuse controls:
- Tier behavior and bypass attempts
- Actor identity assumptions (IP vs user) and impact
- Retry behavior under pressure and queue backlog

5. Error handling and data leakage:
- Provider/internal errors do not leak secrets
- Stable error codes/details for client behavior

## Deliverables

1. Route-by-route authz test matrix
2. Queue/state-invariant validation report
3. Remediation backlog for any broken invariants

## Exit criteria

1. No confirmed cross-tenant data/action access.
2. Terminal-state guarantees hold under retry/replay/cancel races.
3. No high-severity data leakage in API errors.
