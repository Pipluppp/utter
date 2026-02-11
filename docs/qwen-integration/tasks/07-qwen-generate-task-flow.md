# 07 - Qwen Generate Task Flow

## Goal

Keep the current task-based generate API while implementing qwen-mode synthesis via non-streaming HTTP orchestration and durable audio persistence.

## In Scope

- `POST /api/generate` qwen-mode orchestration.
- `GET /api/tasks/:id` behavior for qwen tasks.
- Finalization and cancellation semantics.

## Out of Scope

- Realtime streaming endpoints.
- Frontend playback implementation details.

## Interfaces Impacted

- `POST /api/generate`
- `GET /api/tasks/:id`
- `POST /api/tasks/:id/cancel`

## Files/Modules Expected to Change

- `supabase/functions/api/routes/generate.ts`
- `supabase/functions/api/routes/tasks.ts`
- `supabase/functions/_shared/tts/providers/qwen_synthesis.ts`
- `supabase/functions/_shared/tts/providers/qwen_audio.ts`

## Step-by-Step Implementation Notes

1. Keep request validation and response shape of `POST /api/generate` unchanged.
- Enforce `text.length <= QWEN_MAX_TEXT_CHARS` (default 600) and return `400` on overflow.

2. In qwen mode, generation preconditions:
- Voice exists and belongs to user.
- Voice has `tts_provider='qwen'`.
- Voice has non-null `provider_voice_id` and `provider_target_model`.
- `provider_target_model` is one of the pinned models for this rollout:
- `qwen3-tts-vc-2026-01-22` for cloned voices.
- `qwen3-tts-vd-2026-01-26` for designed voices.

3. Create generation + task rows as today, but set provider fields:
- task `provider='qwen'`
- generation `tts_provider='qwen'`

4. Start background generation using `EdgeRuntime.waitUntil`.

5. Qwen non-streaming synthesis flow (grounded in `docs/qwen-api.md`):
- Send HTTP request to synthesis endpoint with `model=<provider_target_model>`, `input.text`, `input.voice`, `input.language_type`.
- Receive response containing `output.audio.url`, `output.audio.id`, `output.audio.expires_at`, `request_id`.
- Download audio from temporary URL.
- Upload bytes to app storage bucket.
- Persist generation/task completion metadata.

6. Task status model in qwen mode:
- `pending` -> `processing` -> `completed|failed|cancelled`
- `provider_status` examples: `provider_submitting`, `provider_synthesizing`, `provider_downloading`, `provider_persisting`, `completed`.

7. `GET /api/tasks/:id` in qwen mode reads DB state only.
- Do not poll provider status endpoints here.
- Return latest persisted task state and result.

8. Cancellation behavior:
- `POST /api/tasks/:id/cancel` marks cancellation requested.
- Worker checks cancellation state before provider call, before download, and before upload.
- Final status should converge to `cancelled` where possible.

9. Idempotent finalization guard:
- Only upload/store if generation audio key is null.

10. Throttling policy for this phase:
- Do not add extra per-user provider rate limits here.
- Credit-based enforcement is deferred to the billing/credit system.

## Data and Failure Modes

Failure modes:
1. Provider call fails before audio URL is returned.
- Mitigation: mark task/generation failed with provider error category.
2. Temporary URL expires before download.
- Mitigation: immediate download and bounded retry.
3. Upload/persistence failure after successful provider synthesis.
- Mitigation: fail task with explicit metadata and request ID.
4. Cancellation arrives after finalization.
- Mitigation: terminal state precedence rules.

## Validation Checks

### Preconditions

- Tasks 03-06 completed.
- Qwen secrets and target models configured.

### Command list

```bash
npm run test:edge
rg -n "qwen3-tts-vc-2026-01-22|qwen3-tts-vd-2026-01-26|multimodal-generation/generation" supabase/functions
```

Manual smoke:

```bash
# 1) POST /api/generate
# 2) Poll /api/tasks/:id until terminal
# 3) Verify generation audio URL works
# 4) Repeat with cancel path
```

### Expected success output/state

- Existing frontend polling UX works unchanged.
- Qwen tasks progress to terminal states without provider polling from task endpoint.
- Audio is persisted and replayable from generation endpoint.

### Failure signatures

- `/api/tasks/:id` tries calling provider status API.
- Completed task has no persisted audio key.
- Cancel endpoint reports success but generation remains processing indefinitely.

## Exit Criteria

- v1 task flow works in qwen mode with non-streaming internals.
- Task endpoint remains backward compatible and deterministic.

## Rollback Note

Switch provider mode to Modal and redeploy API function. See `docs/qwen-integration/restoration.md`.
