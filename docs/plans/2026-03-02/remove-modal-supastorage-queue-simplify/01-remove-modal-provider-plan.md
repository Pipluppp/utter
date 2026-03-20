# Plan 01: Remove Modal Provider Paths (Qwen-Only)

## Goal

Remove all Modal provider runtime and config branches so TTS behavior is fully Qwen-based.

## Current complexity to remove

1. Provider toggles (`TTS_PROVIDER_MODE=modal|qwen`)
2. Modal provider client modules
3. Modal-specific queue messages and consumer logic
4. Modal branches in generate/design/tasks routes
5. Modal env vars and docs references

## In-scope code targets

1. Remove files/modules:
- `workers/api/src/_shared/modal.ts`
- `workers/api/src/_shared/tts/providers/modal.ts`

2. Simplify provider typing/config:
- `workers/api/src/_shared/tts/types.ts`
- `workers/api/src/_shared/tts/provider.ts`
- `workers/api/src/env.ts`
- `workers/api/wrangler.toml`
- `workers/api/.dev.vars.example`

3. Remove modal route branches:
- `workers/api/src/routes/generate.ts`
- `workers/api/src/routes/design.ts`
- `workers/api/src/routes/tasks.ts`
- `workers/api/src/queues/messages.ts`
- `workers/api/src/queues/consumer.ts`

4. Ensure clone/design/generate only create `tts_provider='qwen'` semantics where relevant.

## Implementation steps

1. Delete modal provider modules and imports.
2. Change `TtsProviderName` to `"qwen"` only.
3. Remove `TTS_PROVIDER_MODE` switching logic; make Qwen config required.
4. Remove modal queue message types:
- `design_preview.modal.start`
- `generate.modal.check`
5. Remove modal poll/finalize flow from `/api/tasks/:id`.
6. Remove modal-specific env vars and feature flags.
7. Update tests to reflect single provider behavior.
8. Execute one-time staging DB cleanup/compat handling for stale test rows with `provider='modal'` or `tts_provider='modal'`.

## Acceptance criteria

1. No code paths reference `modalProvider` or `MODAL_*` env vars.
2. `POST /api/generate` and `POST /api/voices/design/preview` always use Qwen queue path.
3. `workers/api` builds and typechecks without Modal modules.
4. Parity tests for active features pass against Worker target.

## Risks

1. No fallback provider during Qwen outage.
2. Legacy rows containing `tts_provider='modal'` may need explicit handling policy.

## Mitigation

1. Add explicit 409/422 handling for unsupported legacy provider rows (if present).
2. Capture one-time DB cleanup script for test/stale modal records if needed.
