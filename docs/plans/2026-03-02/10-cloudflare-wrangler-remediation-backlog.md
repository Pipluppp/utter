# Cloudflare/Wrangler Remediation Backlog

Date: 2026-03-02

## Must fix before production cutover

1. Finalize production R2 bindings
- Risk: storage runtime cannot serve expected objects in `r2` mode.
- Owner: platform/backend
- Effort: small

2. Finalize production Queue bindings and flags
- Risk: async qwen paths may execute in-request unexpectedly or not process.
- Owner: platform/backend
- Effort: small

3. Confirm production CORS origin allowlist
- Risk: over-permissive or misconfigured cross-origin behavior.
- Owner: backend/security
- Effort: small

## High priority post-cutover

1. Secret rotation runbook
- Define cadence, owner, and rotation sequence for Worker secrets.

2. Frontend Worker deploy validation script
- Add `workers/frontend` dry-run/check command parity with API worker.

3. Verified user-aware rate limiting
- Current mitigation uses IP-based actor identity to prevent spoofing.
- Future improvement: restore user-aware buckets only with verified identity source.

4. Ops runbook for queue incidents
- Cover DLQ replay procedure, retry storms, and provider outage mode.

5. Security headers baseline on frontend responses
- Add and validate safe default browser hardening headers.

## Nice to have

1. Typed env generation for frontend worker and shared env contract docs.
2. Consolidated release checklist command script from existing docs artifacts.
3. Automated CORS/origin policy assertion in CI.
