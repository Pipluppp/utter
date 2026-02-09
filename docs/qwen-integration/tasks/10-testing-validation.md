# 10 - Testing and Validation

## Goal

Define a full validation matrix for Modal mode and Qwen mode, including API compatibility, data integrity, realtime behavior, and rollback readiness.

## In Scope

- Test matrix by provider mode.
- Required command suite and acceptance criteria.
- Failure signature catalog and triage routing.

## Out of Scope

- Creating every test implementation detail in this doc.
- Performance benchmarking methodology beyond rollout gates.

## Interfaces Impacted

- All touched API routes and provider adapters.
- Supabase DB migrations and RLS behavior.
- Frontend generation flows.

## Files/Modules Expected to Change

- `supabase/functions/tests/*` (new/updated edge tests)
- `supabase/tests/database/*` (schema tests for new columns/indexes)
- optional frontend integration test coverage

## Step-by-Step Implementation Notes

1. Maintain current Modal regression suite as baseline.
2. Add Qwen-mode test coverage for clone/design/generate/stream flows.
3. Add dual-mode contract tests for `/api/languages` capabilities.
4. Add compatibility tests for legacy modal voices in qwen mode (expected `409`).
5. Add cancellation tests for qwen task flow.
6. Add streaming endpoint tests:
- qwen mode streams bytes
- modal mode returns `409`
7. Add DB tests for new provider columns and constraints.
8. Add max-text tests:
- `/api/generate` rejects inputs over 2000 chars.
- `/api/generate/stream` rejects inputs over 2000 chars.
9. Add frontend behavior checks:
- Generate UI counter/validation uses 2000-char limit.
- Incompatible-provider voices are rendered but non-clickable.

## Data and Failure Modes

Failure modes:
1. Modal regression while adding Qwen path.
- Mitigation: keep modal tests mandatory in CI.
2. Incomplete qwen metadata persistence.
- Mitigation: assert provider fields after each flow.
3. Stream endpoint passes locally but fails in deployed edge runtime.
- Mitigation: stage-level smoke suite and canary gates.
4. Validation assumes throttling that is not implemented.
- Mitigation: do not add per-user rate-limit assertions in this phase.

## Validation Checks

### Preconditions

- Tasks 01-09 implemented.
- Local Supabase stack running.

### Command list

```bash
npm run test:db
npm run test:edge
npm run test:all
npm --prefix frontend run check
npm --prefix frontend run typecheck
npm --prefix frontend run build
```

Recommended mode-specific runs:

```bash
# Modal mode
npm run sb:serve
npm run test:edge

# Modal mock mode
npm run sb:serve:test
npm run test:edge

# Qwen mode (using qwen test env or mock adapter)
supabase functions serve api --env-file ./supabase/.env.qwen.test --no-verify-jwt
npm run test:edge
```

### Expected success output/state

- DB tests pass with new provider schema.
- Edge tests pass in Modal mode and Qwen mode.
- Frontend builds and typechecks with capability/type additions.
- Stream endpoint behavior matches provider mode.

### Failure signatures

- New tests only pass in one provider mode.
- Contract shape changes break existing frontend parsing.
- Streaming tests hang or produce non-audio output.

## Exit Criteria

- Test matrix is green for both providers.
- CI can enforce regressions before deployment.
- Failure signatures are documented with clear triage ownership.

## Rollback Note

If qwen-mode tests are red during rollout, force Modal mode and redeploy. See `docs/qwen-integration/restoration.md`.
