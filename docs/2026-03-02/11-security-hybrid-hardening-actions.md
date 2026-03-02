# Security Hardening Actions (Hybrid Stack)

Date: 2026-03-02

## Objective

Track concrete post-implementation security actions for Cloudflare frontend/API + Supabase DB/Auth stack.

## Actions completed in this pass

1. Core docs realigned to current stack
- Reduced stale architecture drift that can cause unsafe operational mistakes.

2. API CORS defaults tightened in Worker config
- Removed wildcard defaults for local/staging baseline.
- Added explicit origin allowlists for local/staging/prod placeholder state.

3. Rate-limit actor spoofing mitigation
- Updated API rate-limit identity resolution to use IP-based actors only.
- Removed reliance on unverified JWT payload parsing for security decisions.

## Additional medium-priority actions

1. Production secret rotation playbook
- Define cadence and emergency rotation sequence.

2. Verified user-aware rate limiting
- Future improvement: reintroduce per-user buckets only when middleware has verified user identity context.

3. Frontend/browser security headers baseline
- Add `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` (and optional CSP after compatibility validation).

4. Queue abuse drills
- Simulate poison/replay and verify DLQ handling/recovery runbook.

5. Stripe webhook abuse regression checks
- Validate expected failure behavior for replay, invalid signatures, and malformed payloads.

## Evidence and references

- `security/audits/2026-03-02/cloudflare-hybrid-phase-01.md`
- `security/audits/2026-03-02/cloudflare-hybrid-phase-02.md`
- `security/audits/2026-03-02/cloudflare-hybrid-phase-03.md`
- `security/audits/2026-03-02/cloudflare-hybrid-phase-04.md`
- `2026-03-02/09-cloudflare-wrangler-audit-report.md`
- `2026-03-02/10-cloudflare-wrangler-remediation-backlog.md`
