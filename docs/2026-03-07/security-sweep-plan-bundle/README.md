# Security Sweep Plan Bundle (2026-03-03)

This folder kickstarts a full security analysis of the current stack:

1. Frontend SPA + auth/session handling
2. Cloudflare frontend/API workers and API contract
3. Queue-first orchestration and consumer behavior
4. Supabase Auth/Postgres/RLS/credits/billing controls
5. Cloudflare infrastructure (R2, Queues, Wrangler config, secrets)
6. Abuse/fraud/misuse scenarios

## Guiding approach

This plan follows a maturity-first sequence inspired by Neil Madden's principle that active vulnerability hunting should come after process hardening, standards, and triage readiness:

- https://neilmadden.blog/2026/02/20/looking-for-vulnerabilities-is-the-last-thing-i-do/

## Plan set

1. `01-security-maturity-first-plan.md`
2. `02-system-threat-model-and-attack-surface-plan.md`
3. `03-frontend-security-and-session-testing-plan.md`
4. `04-api-worker-and-queue-security-testing-plan.md`
5. `05-supabase-auth-rls-and-postgres-security-plan.md`
6. `06-cloudflare-infra-secrets-r2-queues-plan.md`
7. `07-abuse-fraud-and-platform-misuse-plan.md`
8. `08-penetration-testing-execution-plan.md`
9. `09-remediation-verification-and-governance-plan.md`

Execution tracking: `implementation-checklist.md`
Task board: `tasks.md`
Execution matrix: `security-test-matrix.md`
Evidence template: `evidence-template.md`
Ownership/SLA template: `owners-and-sla.md`

## Recommended start order

1. Fill `owners-and-sla.md`
2. Run the quick-win set in `security-test-matrix.md`
3. Record findings using `evidence-template.md`
4. Track progress in `implementation-checklist.md`

## Scope boundaries

1. Keep `/api/*` contract stable unless a security fix requires change.
2. Keep Supabase as system of record for auth, relational data, and billing/credits.
3. Keep simplified runtime assumptions intact (qwen-only, R2-only, queue-first).
4. Prioritize pre-production hardening of `utter` / `utter-api-staging`.

## Related plan packs (same date)

1. Multi-job execution + Job Center UX: `multi-job-tracking-ui-ux/README.md`
2. Multi-job execution checklist: `multi-job-tracking-ui-ux/implementation-checklist.md`
