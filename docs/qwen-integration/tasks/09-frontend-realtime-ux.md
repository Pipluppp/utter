# 09 - Frontend Realtime UX

## Goal

Deliver provider-aware generation UX where Qwen mode defaults to realtime playback and Modal mode keeps existing wait-then-play behavior.

## In Scope

- Generate page behavior branching by backend capabilities.
- Dev/staging-only toggle for generate mode.
- Fallback behavior when streaming is unavailable or fails.

## Out of Scope

- Full redesign of Generate page visual layout.
- Changes to Clone/Design page content outside provider capability display.

## Interfaces Impacted

- `GET /api/languages` capability payload.
- `POST /api/generate` (existing task mode).
- `POST /api/generate/stream` (new stream mode).

## Files/Modules Expected to Change

- `frontend/src/lib/types.ts`
- `frontend/src/pages/hooks.ts` (languages loading)
- `frontend/src/pages/Generate.tsx`
- `frontend/src/components/tasks/TaskProvider.tsx` (if needed for mode coordination)
- optional new helper modules for stream playback

## Step-by-Step Implementation Notes

1. Extend frontend language/capability model.
- Add fields in `LanguagesResponse` for provider and streaming capabilities.

2. Mode selection rules.
- If provider is Modal: use existing task flow only.
- If provider is Qwen and stream capability is true: default to stream flow.
3. Text cap alignment.
- Set Generate input max to 2000 chars in UI validation.
- Update visible counter/help copy to 2000-char max.

4. Realtime playback behavior in Qwen mode.
- Start streaming request.
- Play audio progressively as bytes arrive.
- On stream completion, set final replay/download URL from persisted generation.

5. Dev/staging-only toggle policy.
- Feature flag controls visibility, example `VITE_ENABLE_QWEN_GENERATE_MODE_TOGGLE=true`.
- Toggle options: `Realtime` vs `Standard`.
- In production default, hide toggle and auto-select mode from capabilities.

6. Voice list interaction policy across providers.
- Show voices from all providers in lists for transparency/history context.
- If a voice `tts_provider` does not match active provider mode, omit clickability/actions on that row.
- In Generate page, disable selection for incompatible voices with helper text.

7. Fallback behavior.
- If stream endpoint returns unsupported/failed response, automatically fallback to v1 task flow and notify user.

8. Modal UX remains unchanged.
- Continue showing task progress and post-complete playback.

## Data and Failure Modes

Failure modes:
1. Capability payload missing -> ambiguous mode.
- Mitigation: conservative fallback to v1 task flow.
2. Stream playback unsupported by browser/runtime.
- Mitigation: detect and fallback to v1.
3. Toggle exposed in production accidentally.
- Mitigation: environment-gated rendering and CI checks.
4. Frontend text cap mismatches backend validation.
- Mitigation: single shared constant for max chars and contract test.
5. Incompatible provider voices still clickable.
- Mitigation: disable UI actions based on `tts_provider` vs active provider.

## Validation Checks

### Preconditions

- Task 02 contracts and task 08 endpoint are implemented.
- Capability fields from `/api/languages` are available.

### Command list

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run check
npm --prefix frontend run build
```

Manual browser checks:

```text
1) Qwen mode: Generate starts realtime playback and final output remains in history.
2) Qwen mode + forced stream error: fallback to task flow works.
3) Modal mode: unchanged wait-then-play behavior.
4) Dev/staging flag off: toggle hidden.
5) Dev/staging flag on: toggle visible and functional.
6) Generate counter and validation enforce 2000-char max.
7) Non-active-provider voices appear but are not clickable/selectable.
```

### Expected success output/state

- Qwen mode defaults to realtime playback.
- Modal mode behavior remains unchanged.
- Toggle is constrained to dev/staging by feature flag.

### Failure signatures

- Generate page always uses one mode regardless of capabilities.
- Stream failure leaves UI stuck without fallback.
- Toggle visible in production when not intended.

## Exit Criteria

- Provider-aware UX is stable and deterministic.
- Fallback behavior avoids user-facing dead ends.

## Rollback Note

Disable stream capability in backend and frontend flags; continue with v1 task mode only. See `docs/qwen-integration/restoration.md`.
