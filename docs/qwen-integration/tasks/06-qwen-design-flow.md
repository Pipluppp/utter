# 06 - Qwen Design Flow

## Goal

Implement qwen-mode voice design so preview generation and voice persistence use a single billable design creation, avoiding duplicate provider creates.

## In Scope

- `POST /api/voices/design/preview` and design task lifecycle in qwen mode.
- `POST /api/voices/design` persistence behavior using prior preview task output.
- Storage + DB persistence of preview and provider metadata.

## Out of Scope

- Modal design behavior changes.
- Frontend page layout redesign.

## Interfaces Impacted

- `POST /api/voices/design/preview`
- `GET /api/tasks/:id` for `design_preview` tasks
- `POST /api/voices/design`

## Files/Modules Expected to Change

- `supabase/functions/api/routes/design.ts`
- `supabase/functions/api/routes/tasks.ts`
- `supabase/functions/_shared/tts/providers/qwen_customization.ts`

## Step-by-Step Implementation Notes

1. Preserve existing preview route contract (`task_id`, `status`).

2. In qwen mode, preview task execution performs one provider create call:
- Customization REST `model = qwen-voice-design`.
- Target model pinned to `qwen3-tts-vd-2026-01-26`.
- Capture:
- `output.voice`
- `output.target_model`
- `output.preview_audio`
- `request_id`

Request payload shape:

```json
{
  "model": "qwen-voice-design",
  "input": {
    "action": "create",
    "target_model": "qwen3-tts-vd-2026-01-26",
    "voice_prompt": "A deep, steady narrator voice",
    "preview_text": "Hello, this is a preview.",
    "preferred_name": "narrator_1",
    "language": "en"
  },
  "parameters": {
    "sample_rate": 24000,
    "response_format": "wav"
  }
}
```

Expected response fields:

```json
{
  "output": {
    "voice": "qwen-tts-vd-...",
    "preview_audio": { "data": "<base64>" },
    "target_model": "qwen3-tts-vd-2026-01-26"
  },
  "usage": { "count": 1 },
  "request_id": "uuid"
}
```

3. Persist preview output safely:
- Decode preview audio.
- Upload preview object to Storage (`references` or dedicated preview key).
- Save task result with:
- preview object key
- provider voice ID
- provider target model
- provider request ID
- provider voice kind `vd`

4. Save route (`/voices/design`) must not call design create again.
- Require linkage to the completed preview task (`task_id` in form or metadata field).
- Read provider metadata from task result and persist into `voices` row.
- Validate preview task belongs to caller and is completed.
- This is required because a single design create call already returns both provider voice ID and preview audio.

5. Grounded from `docs/qwen-api.md`:
- Design create is billable and consumes voice quota.
- Preview is returned by design create, unlike clone flow.
- The next API call after save is generation/synthesis, not another design create.

6. Keep Modal path unchanged during dual-provider phase.

## Data and Failure Modes

Failure modes:
1. Duplicate billable design creates from preview + save.
- Mitigation: save route reuses task result metadata only.
2. Preview task metadata missing/incomplete.
- Mitigation: fail save with explicit `detail` and do not insert voice row.
3. Preview audio upload succeeds but task update fails.
- Mitigation: task-level retry and clear failed state for operator visibility.
4. Task replay creates duplicate voice rows.
- Mitigation: idempotency key by task ID on save path.

## Validation Checks

### Preconditions

- Task 03 schema includes voice provider fields.
- Task 04 adapter layer is in place.

### Command list

```bash
npm run test:edge
rg -n "qwen-voice-design|design_preview|provider_voice_kind" supabase/functions
```

Manual smoke:

```bash
# 1) POST /api/voices/design/preview
# 2) Poll GET /api/tasks/:id until completed
# 3) POST /api/voices/design with task linkage
# 4) Verify one voice row with qwen metadata and preview URL
```

### Expected success output/state

- Exactly one provider design create per preview/save flow.
- Saved designed voice has `tts_provider='qwen'`, voice/model metadata set.
- Preview audio remains playable after save.

### Failure signatures

- Save route triggers second provider design call.
- Voice row is created without provider metadata.
- Task result lacks `preview_object_key` and provider IDs.

## Exit Criteria

- Design flow is bill-safe and idempotent.
- Preview and save are linked without duplicate provider creates.

## Rollback Note

Flip to Modal mode and keep existing design API paths. See `docs/qwen-integration/restoration.md`.
