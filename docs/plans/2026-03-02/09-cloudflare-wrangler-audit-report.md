# Cloudflare/Wrangler Audit Report

Date: 2026-03-02
Scope: `workers/api`, `workers/frontend`, and base docs alignment

## Inputs reviewed

- `workers/api/wrangler.toml`
- `workers/frontend/wrangler.toml`
- `workers/api/src/*`
- `workers/frontend/src/index.ts`
- `docs/security/audits/2026-03-02/cloudflare-hybrid-phase-0*.md`

## Scorecard

| Area | Status | Notes |
|---|---|---|
| Worker runtime migration | Meets | API and frontend Workers are deployed and validated in staging. |
| Route contract parity | Meets | Existing parity suite and staging smoke evidence show no route contract break. |
| R2 storage mode controls | Partially meets | `supabase|hybrid|r2` adapter exists; production binding finalization still pending. |
| Queue topology and DLQ | Meets | Q1 queue producer/consumer and DLQ are wired in staging. |
| CORS/origin controls | Partially meets | Defaults were permissive; tightened in this pass, but production origin finalization remains a release gate. |
| Secret handling | Partially meets | Secret names and usage are clear; explicit rotation cadence/runbook still needed. |
| Release/rollback docs | Partially meets | Phase evidence exists; new `deploy.md` added, needs ongoing usage discipline. |
| Observability and incident workflow | Partially meets | Request-id and queue logs exist; no single operational runbook for alerts/escalation yet. |

## Key findings

1. Configuration quality
- Compatibility dates are current and explicit.
- Environment blocks are present.
- Production bucket/queue bindings are intentionally incomplete and must be finalized before full cutover.

2. Binding correctness
- Staging R2 and Queue bindings are present and validated.
- Frontend service binding to API Worker is present.

3. Security posture
- CORS default/staging wildcards were a hardening gap; tightened in this pass.
- Rate-limit actor spoofing risk was mitigated in this pass by forcing IP-based actor identity in middleware until verified-user context is available.

4. Deploy hygiene
- API worker has `check`/dry-run scripts.
- Frontend worker deploy flow is documented, but no dedicated frontend dry-run/check script yet.

## Immediate recommendations

1. Keep explicit origin allowlists per environment (done in config for local/staging/prod placeholder set).
2. Keep rate limiter actor identity IP-based until verified-user identity is available at middleware time.
3. Finalize production R2/Queue bindings and deployment checklists before production cutover.
4. Add a documented secret rotation cadence and ownership.
