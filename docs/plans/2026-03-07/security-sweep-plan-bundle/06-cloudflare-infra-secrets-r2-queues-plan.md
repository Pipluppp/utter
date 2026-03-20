# Plan 06: Cloudflare Infra, Secrets, R2, and Queue Security Sweep

## Goal

Harden Cloudflare runtime and infrastructure configuration to reduce misconfiguration risk across environments.

## Scope

1. Wrangler env configuration and deployment workflow
2. Worker secrets and rotation posture
3. R2 object access model and signed token flow
4. Queue + DLQ behavior and consumer hardening

## Test tasks

1. Environment and deployment checks:
- Verify non-inheritable Wrangler keys are explicitly set per env
- Confirm staging/prod parity for required bindings
- Confirm local queue-backed dev works without `wrangler dev --remote`

2. Secret handling:
- Inventory required secrets per worker/env
- Verify no secrets in repo or static assets
- Review rotation cadence and break-glass procedure

3. R2 access model:
- Verify no public bucket exposure by mistake
- Validate signed upload/download token constraints and expiry
- Attempt object key traversal and token tampering attacks

4. Queue security and resilience:
- Verify producer/consumer binding correctness
- Validate retry classification and backoff behavior
- Exercise DLQ routing and replay workflow

5. Runtime telemetry and detection:
- Tail/log coverage for security-relevant events
- Alert conditions for anomalous rate-limit and auth patterns

## Deliverables

1. Cloudflare config parity checklist
2. Secret and binding inventory per environment
3. R2/Queue attack simulation results

## Exit criteria

1. No critical environment misconfiguration gaps remain.
2. Signed object flow resists token tampering and key traversal.
3. DLQ + replay process is tested and documented.
