# 09 - Frontend Non-Streaming UX

## Goal

Deliver provider-aware generation UX where both Modal mode and Qwen mode use submit/poll/final-playback behavior, with no realtime/live-chunk playback path.

## In Scope

- Generate page behavior branching by backend capabilities.
- Non-streaming task flow in all modes.
- Clear status/progress messaging and fallback behavior.

## Out of Scope

- Full redesign of Generate page visual layout.
- Realtime playback controls.

## Interfaces Impacted

- `GET /api/languages` capability payload.
- `POST /api/generate` (task mode).
- `GET /api/tasks/:id` polling mode.

## Files/Modules Expected to Change

- `frontend/src/lib/types.ts`
- `frontend/src/pages/hooks.ts` (languages loading)
- `frontend/src/pages/Generate.tsx`
- `frontend/src/components/tasks/TaskProvider.tsx`

## Step-by-Step Implementation Notes

1. Extend frontend language/capability model.
- Keep provider and capability fields from `/api/languages`.
- Enforce `supports_generate_stream=false` path.

2. Generate mode rules.
- Modal: use existing task flow.
- Qwen: also use task flow (no stream branch).

3. Text cap alignment.
- Generate input max must match backend cap (`QWEN_MAX_TEXT_CHARS`, default 600 in qwen mode).
- Update visible counter/help copy accordingly.

4. Playback behavior.
- Submit generation request.
- Poll task status until terminal.
- On completion, play final durable audio URL.

5. Voice list interaction policy across providers.
- Show voices from all providers in lists for transparency/history context.
- If a voice `tts_provider` does not match active provider mode, omit clickability/actions on that row.

6. Failure and fallback behavior.
- If qwen generation fails, show actionable error from normalized `{ detail }` response.
- No stream fallback path is needed because stream mode is disabled.

7. Modal UX remains unchanged.
- Continue showing task progress and post-complete playback.

## Data and Failure Modes

Failure modes:
1. Capability payload missing -> ambiguous mode.
- Mitigation: conservative fallback to task flow.
2. Frontend text cap mismatches backend validation.
- Mitigation: shared constant or fetched limit in capability payload.
3. Incompatible provider voices still clickable.
- Mitigation: disable UI actions based on `tts_provider` vs active provider.

## Validation Checks

### Preconditions

- Task 02 contracts and task 07/08 backend flows are implemented.

### Command list

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run check
npm --prefix frontend run build
```

Manual browser checks:

```text
1) Qwen mode: Generate uses task flow and final output remains in history.
2) Modal mode: unchanged wait-then-play behavior.
3) Generate counter and validation enforce configured max chars.
4) Non-active-provider voices appear but are not clickable/selectable.
5) Error states display normalized backend detail.
```

### Expected success output/state

- Qwen mode uses non-streaming task flow.
- Modal mode behavior remains unchanged.
- No realtime/live-chunk UI path exists.

### Failure signatures

- Generate page branches into a removed stream path.
- Task completion succeeds but playback URL is missing.
- UI allows selecting voices incompatible with current provider mode.

## Exit Criteria

- Provider-aware non-streaming UX is stable and deterministic.
- No dead-end states in generate flow.

## Rollback Note

Continue using task mode in both providers and force Modal mode if needed. See `docs/qwen-integration/restoration.md`.
