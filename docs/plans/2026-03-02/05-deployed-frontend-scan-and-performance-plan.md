# Plan: Deployed Frontend Scans and Performance Evaluation

## Goal

Assess deployed frontend security posture and performance characteristics on staging, then compare with expected baseline.

## Targets

1. Cloudflare frontend staging: `https://utter.duncanb013.workers.dev`
2. API origin dependency path: `https://utter-api-staging.duncanb013.workers.dev`
3. Optional historical comparison target: existing Vercel deployment

## Scan categories

1. HTTP/security headers and TLS posture
2. Dependency and client-side exposure checks
3. OWASP baseline dynamic scan of public surface
4. Lighthouse/Web Vitals performance and accessibility snapshots
5. Core user flow latency checks:
   - landing load
   - auth load
   - generate submit
   - history fetch

## Tasks

1. Define repeatable scan command set and cadence.
2. Record baseline metrics (P50/P95 where available).
3. Identify regressions or risky deltas versus expected UX.
4. Produce prioritized action list for hardening/perf.

## Deliverables

1. `frontend-scan-baseline.md`
2. `frontend-performance-baseline.md`
3. `frontend-scan-findings-and-actions.md`

## Exit criteria

1. No critical web-surface security gaps
2. Performance budget and current baseline are documented
3. Re-run instructions exist for release gates
