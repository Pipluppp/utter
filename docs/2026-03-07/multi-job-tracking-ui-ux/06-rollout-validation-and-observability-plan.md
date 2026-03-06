# Plan 06: Rollout, Validation, and Observability

## Goal

Ship multi-job support safely with measurable behavior and rollback controls.

## Rollout strategy

1. Feature flags:
- backend cap enablement flag/value
- frontend Job Center visibility flag

2. Staged rollout:
- local dev -> staging internal users -> broader staging -> production

## Validation tasks

1. Automated tests:
- backend: concurrent submit up to cap, cap rejection, cancellation safety
- frontend: provider state reducer/migration/polling behavior
- integration: multi-job lifecycle across generate/design

2. Manual smoke:
- start 2-3 generate jobs rapidly
- cancel one mid-flight
- verify others complete and UI tracks all correctly
- reload app during active jobs and confirm recovery

3. Performance checks:
- polling load on API worker
- queue depth/latency under multi-job usage
- UI responsiveness with 50+ recent jobs

## Observability additions

1. Metrics/log counters:
- `jobs_submitted_total`
- `jobs_rejected_cap_total`
- `jobs_cancelled_total`
- `jobs_terminal_failed_total`

2. Alerting thresholds:
- unusual cap-rejection spikes
- queue backlog growth
- terminal failure-rate spikes

## Rollback plan

1. Lower cap to 1 to emulate current behavior.
2. Hide Job Center via flag if UI issue appears.
3. Preserve existing task detail routes as fallback UI path.

## Acceptance criteria

1. Multi-job support runs stable in staging under realistic load.
2. Operational metrics exist to tune cap and detect regressions.
3. Rollback path is simple and documented.
