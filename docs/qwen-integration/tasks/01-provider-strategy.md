# 01 - Provider Strategy

## Goal

Define a single provider strategy that supports both Modal and official Qwen without fragmenting route behavior or creating mixed-provider voice incompatibilities.

## In Scope

- Runtime provider selection mechanism.
- Atomic provider mode policy for clone/design/generate.
- Environment defaults and secrets matrix.
- Legacy voice compatibility policy.

## Out of Scope

- Route-level implementation details.
- Database DDL specifics (task 03).
- Frontend UI implementation details (task 09).

## Interfaces Impacted

- `GET /api/languages` capability payload.
- Internal provider resolver used by:
- `POST /api/clone/finalize`
- `POST /api/voices/design/preview`
- `POST /api/voices/design`
- `POST /api/generate`
- `GET /api/tasks/:id`
- `POST /api/tasks/:id/cancel`

## Files/Modules Expected to Change

- `supabase/functions/api/routes/languages.ts`
- `supabase/functions/_shared/tts/provider.ts` (new)
- `supabase/functions/_shared/tts/types.ts` (new)
- Route modules that currently import `../../_shared/modal.ts`

## Step-by-Step Implementation Notes

1. Add `TTS_PROVIDER_MODE` env variable with allowed values `modal|qwen`.
2. Build a single resolver (`getTtsProvider()`) and prohibit per-route provider drift.
3. Enforce atomicity:
- If mode is `qwen`, clone/design/generate all use qwen adapters.
- If mode is `modal`, clone/design/generate all use modal adapters.
4. Define environment defaults:
- Local development: `modal`.
- Production: `qwen` after cutover task gates.
5. Pin qwen integration defaults:
- Provider lane: international (`dashscope-intl.aliyuncs.com`).
- VC model: `qwen3-tts-vc-2026-01-22`.
- VD model: `qwen3-tts-vd-2026-01-26`.
- Max text cap default: `QWEN_MAX_TEXT_CHARS=600`.
6. Add legacy compatibility policy:
- Modal voices remain usable in modal mode.
- Qwen mode requires `provider_voice_id` and `provider_target_model` on voice rows.
- Missing provider metadata returns `409` with re-clone/re-design guidance.
7. UI provider-mismatch policy for lists:
- Keep cross-provider rows readable in list endpoints.
- Omit clickability/actions for rows not matching active provider mode.
8. Voice deletion policy:
- Do not call Qwen provider delete API on user delete.
- Use app-level soft delete semantics to remove user access.
9. Rate limiting policy:
- Keep existing route-level abuse controls active for provider-cost endpoints.
- Enforce request/payload bounds before provider calls.
- Defer advanced quota redesign to billing/credits follow-up work.
10. Expose capabilities in `/api/languages` so frontend can branch behavior by provider features.

## Data and Failure Modes

Data assumptions:
- Voice rows can contain provider metadata fields (task 03).

Failure modes:
1. Provider env missing or invalid.
- Mitigation: fail fast at startup or first request with explicit `detail`.
2. Route bypasses resolver and calls Modal/Qwen directly.
- Mitigation: refactor imports to provider interface only.
3. Mixed provider operations on same voice.
- Mitigation: strict compatibility checks and `409` errors.

## Validation Checks

### Preconditions

- Supabase edge function runs with env support (`npm run sb:serve` / deployed secrets).
- Task 03 schema is applied for provider metadata checks.

### Command list

```bash
rg -n "TTS_PROVIDER_MODE|getTtsProvider|supports_generate" supabase/functions
curl -s http://127.0.0.1:54321/functions/v1/api/languages
```

### Expected success output/state

- Resolver exists and is the only route entry path for provider operations.
- `/api/languages` includes provider mode and capability fields.
- Invalid `TTS_PROVIDER_MODE` yields deterministic JSON error.

### Failure signatures

- Routes still import `_shared/modal.ts` directly for business logic after adapter introduction.
- `/api/languages` always returns fixed provider string regardless of env.
- Incompatible voices proceed to generation instead of failing early.

## Exit Criteria

- Provider mode behavior is globally deterministic and documented.
- Capability payload enables frontend behavior gating.
- Legacy compatibility policy is implemented and testable.

## Rollback Note

Use `docs/qwen-integration/restoration.md` and apply env switch rollback first.
