# S4: OWASP Top 10 2025 Control Map

Backlinks: `README.md`, `S5-security-scanner-pipeline.md`, `S6-rate-limits-observability.md`

Goal: map OWASP concept -> concrete project control. No vague policy talk.

Primary source: <https://owasp.org/Top10/2025/>

## Relevant categories for this project

### A01 Broken Access Control

Risk here:
- wrong grants/RLS/RPC execute.
- cross-user data leak via table/storage/API.

Controls:
- `S1` least-privilege grants + pgTAP checks.
- `S2` outside-in probes.
- `S3` scenario testing with supashield.

### A02 Security Misconfiguration

Risk here:
- open CORS config in prod.
- accidental public bucket.
- exposed schemas/permissions drift.

Controls:
- CORS locked with `CORS_ALLOWED_ORIGIN`.
- storage private + policy checks.
- supashield audit + monthly drift run.

### A03 Software Supply Chain Failures

Risk here:
- vulnerable dependency chain in frontend/edge tooling.

Controls:
- `S5` SCA with OSV + package manager audit.
- version pinning and update cadence.

### A07 Authentication Failures

Risk here:
- missing/weak auth checks in edge routes.

Controls:
- route-level `requireUser()` on protected endpoints.
- Deno tests for unauth/invalid token behavior.

### A09 Security Logging and Monitoring Failures

Risk here:
- attacks happen, no signal.

Controls:
- `S6` structured auth/rate-limit/error logs.
- alert thresholds and runbook.

### A10 Mishandling Exceptional Conditions

Risk here:
- timeout/failure paths leak data or bypass checks.

Controls:
- explicit failure contracts in API.
- tests for failure branches (job submit/status failure, cancellation races).

## Scanner stack mapping from discussion

Quoted ideas: SAST, SCA, SIC, Privacy, DAST.

Practical mapping for this repo:
- SAST: Semgrep or CodeQL.
- SCA: OSV-Scanner + `npm audit` supplemental.
- SIC (interpreted as code integrity/config posture): supashield lint/audit + custom policy checks.
- Privacy: secrets scan + PII log review in `S6`.
- DAST: OWASP ZAP baseline against deployed app/API.

## Exit criteria

- Every chosen OWASP category above has at least one concrete control implemented and tested.
- scanner findings triaged by severity with clear SLA.

Next: `S5-security-scanner-pipeline.md`.
