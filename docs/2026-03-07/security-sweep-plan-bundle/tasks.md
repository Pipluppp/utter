# Security Sweep Task Board (2026-03-03)

Primary source: `docs/2026-03-03/README.md` + Plans 01-09.

Execution artifacts:
- `owners-and-sla.md`
- `security-test-matrix.md`
- `evidence-template.md`

## Workstream 1: Security foundation

1. Assign owners and security champions by surface
2. Publish severity rubric and fix SLAs
3. Finalize incident and disclosure runbook

Source: `01-security-maturity-first-plan.md`

## Workstream 2: Threat model and attack surface

1. Produce architecture trust-boundary diagram
2. Build attack-surface register per `/api/*` family
3. Prioritize top abuse hypotheses

Source: `02-system-threat-model-and-attack-surface-plan.md`

## Workstream 3: Frontend and browser security

1. Validate auth/session URL and token handling in deployed assets
2. Audit browser security headers and static asset exposure
3. Run dependency risk sweep and triage findings

Source: `03-frontend-security-and-session-testing-plan.md`

## Workstream 4: API + queue security

1. Execute route-level authz matrix (unauth/auth/cross-tenant)
2. Test queue replay/race conditions and terminal-state invariants
3. Validate rate-limit and idempotency hardening

Source: `04-api-worker-and-queue-security-testing-plan.md`

## Workstream 5: Supabase and data-layer security

1. Audit auth key model and server/client key boundaries
2. Verify grants/RLS/function exposure across core tables
3. Validate credits/billing ledger integrity under retries

Source: `05-supabase-auth-rls-and-postgres-security-plan.md`

## Workstream 6: Cloudflare infra security

1. Verify per-env Wrangler binding parity and non-inheritable keys
2. Audit secrets inventory and rotation process
3. Test R2 signed-token controls and Queue/DLQ operations

Source: `06-cloudflare-infra-secrets-r2-queues-plan.md`

## Workstream 7: Abuse and fraud resilience

1. Run account farming and economic abuse scenarios
2. Test queue/resource exhaustion patterns
3. Define and validate abuse detection signals and response actions

Source: `07-abuse-fraud-and-platform-misuse-plan.md`

## Workstream 8: Pen test execution and closure

1. Run structured internal pen test pass
2. Prepare external pen test scope package
3. Triage findings and execute fix/retest cycle

Source: `08-penetration-testing-execution-plan.md`, `09-remediation-verification-and-governance-plan.md`

## Tracking

- Use `implementation-checklist.md` for completion status.
