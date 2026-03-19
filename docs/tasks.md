# Tasks Jump Point

## Current objective

Security penetration and architecture sweep for frontend, workers/API, Supabase auth/db/RLS, Cloudflare infra, and abuse handling.

Primary source: `docs/2026-03-07/security-sweep-plan-bundle/`.

## Active tasks

1. Security maturity + threat model baseline
- Establish ownership, severity/SLA, and attack-surface register.
- Source: `2026-03-07/security-sweep-plan-bundle/01-security-maturity-first-plan.md`
- Source: `2026-03-07/security-sweep-plan-bundle/02-system-threat-model-and-attack-surface-plan.md`

2. Component security sweeps
- Execute targeted security tests for frontend, API/queue, Supabase auth/RLS/db, and Cloudflare infra.
- Source: `2026-03-07/security-sweep-plan-bundle/03-frontend-security-and-session-testing-plan.md`
- Source: `2026-03-07/security-sweep-plan-bundle/04-api-worker-and-queue-security-testing-plan.md`
- Source: `2026-03-07/security-sweep-plan-bundle/05-supabase-auth-rls-and-postgres-security-plan.md`
- Source: `2026-03-07/security-sweep-plan-bundle/06-cloudflare-infra-secrets-r2-queues-plan.md`

3. Abuse, pen test, and remediation closure
- Run abuse scenarios, active pen tests, and fix/retest governance cycle.
- Source: `2026-03-07/security-sweep-plan-bundle/07-abuse-fraud-and-platform-misuse-plan.md`
- Source: `2026-03-07/security-sweep-plan-bundle/08-penetration-testing-execution-plan.md`
- Source: `2026-03-07/security-sweep-plan-bundle/09-remediation-verification-and-governance-plan.md`

## Recently completed

1. Cloudflare Supabase Auth Proxy
- Date: 2026-03-19
- Scope: moved all browser auth traffic (sign-in, session, sign-out) from direct Supabase calls to `uttervoice.com/api/auth/*` via Cloudflare Workers. Publishable key and project ref no longer visible in browser network traffic. Cookie-based auth (httpOnly, Secure, SameSite=Lax) replaces browser-managed Supabase tokens.
- Evidence: `2026-03-19/02-cloudflare-supabase-proxy/live-network-audit-post-fix.md`

2. API Worker Privatization
- Date: 2026-03-19
- Scope: disabled public `workers.dev` route for the API Worker; all API traffic routes through `uttervoice.com/api/*` via frontend Worker service binding.
- Source: `2026-03-19/01-api-worker-privatization/README.md`

3. Simplification implementation pass
- Date: 2026-03-03
- Scope: removed Modal runtime paths, removed Supabase/hybrid storage branches, enforced queue-first async execution.

4. Cloudflare migration implementation (phase 01-04)
- Date: 2026-03-01 to 2026-03-02
- Evidence: `security/audits/2026-03-02/cloudflare-hybrid-phase-0*.md`

5. Multi-job + Job Center planning pack
- Date: 2026-03-03
- Scope: implementation plans for multi-job execution and robust job tracking UX beyond History.
- Source: `2026-03-07/multi-job-tracking-ui-ux/README.md`
