# 2026-03-02 Cloudflare Migration Continuation

This folder contains post-implementation continuation artifacts after the migration work in `../2026-03-01/`.

## Context snapshot

- Frontend is running on Cloudflare Worker (`utter`).
- API is running on Cloudflare Worker (`utter-api-staging`).
- Supabase remains system-of-record for Postgres/Auth/RLS/credits/billing.
- R2 + Queue are active for async object/task lifecycle.

## Planning artifacts

1. `01-feature-parity-verification-plan.md`
2. `02-dev-and-staging-runtime-evaluation-plan.md`
3. `03-cloudflare-wrangler-implementation-audit-plan.md`
4. `04-security-evaluation-and-pentest-plan.md`
5. `05-deployed-frontend-scan-and-performance-plan.md`
6. `06-current-stack-and-equivalence-explainer.md`
7. `07-base-docs-realignment-plan.md`
8. `08-architecture-and-setup-docs-simplification-plan.md`

## Simplification execution pack (new)

- `remove-modal-supastorage-queue-simplify/`
  - Removes Modal runtime branches (qwen-only)
  - Removes Supabase/hybrid storage branches (R2-only)
  - Enforces queue-first orchestration and read-only `GET /tasks/:id`
  - Includes integrated validation + docs realignment plans/checklist

## New outcome artifacts (this pass)

1. `09-cloudflare-wrangler-audit-report.md`
2. `10-cloudflare-wrangler-remediation-backlog.md`
3. `11-security-hybrid-hardening-actions.md`
4. `12-docs-realignment-change-list.md`

## Supporting evidence

- `../security/audits/2026-03-02/cloudflare-hybrid-phase-01.md`
- `../security/audits/2026-03-02/cloudflare-hybrid-phase-02.md`
- `../security/audits/2026-03-02/cloudflare-hybrid-phase-03.md`
- `../security/audits/2026-03-02/cloudflare-hybrid-phase-04.md`
