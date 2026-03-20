# S6: Rate Limits + Observability

Backlinks: `README.md`, `S4-owasp-2025-control-map.md`

Goal: reduce abuse cost. make attacks visible fast.

## Current risk

High-cost routes exist now:
- `/api/generate`
- `/api/clone/upload-url`
- `/api/clone/finalize`
- `/api/voices/design/preview`
- `/api/voices/design`
- `/api/transcriptions`

No strong global limiter currently enforced in edge middleware.

## Step-by-step implementation

1. Define endpoint tiers + quotas.

Example baseline:
- Tier 1 expensive: 10 req / 5 min / user, 30 req / 5 min / IP.
- Tier 2 medium: 60 req / 5 min / user.
- Tier 3 low: 240 req / 5 min / IP.

2. Implement middleware in `supabase/functions/api/index.ts`.
- resolve route tier by path+method.
- keying:
  - if auth user exists: `user:{id}`
  - else: `ip:{client_ip}` (fallback: hashed `x-forwarded-for` or request fingerprint)
- return 429 JSON contract:
  - `detail`
  - `retry_after_seconds`

3. Persist counters in durable store.
- preferred: Postgres table + atomic RPC (`rate_limit_check_and_increment`).
- avoid in-memory-only counters in edge runtime.

4. Add structured logs at middleware boundary.
- fields:
  - `timestamp`
  - `request_id`
  - `method`
  - `path`
  - `user_id` nullable
  - `ip_hash`
  - `tier`
  - `decision` allow/deny
  - `status_code`

5. Add alert rules.
- 429 spike on Tier 1.
- 401/403 anomaly.
- 5xx spike on generation/design flows.

## Verification

1. Automated tests (add in `supabase/functions/tests`).
- burst on Tier 1 route -> receives 429 after threshold.
- low-tier routes remain functional under normal burst.
- 429 response shape stable.

2. Manual burst test.
- controlled loop via curl on staging and production.
- verify logs and counters.

3. Incident drill.
- tighten quota quickly.
- verify immediate behavior change.

## Exit criteria

- limiter active on Tier 1/2 routes.
- telemetry visible.
- alerting tested.

Next: `S7-runbook-release-gates.md`.
