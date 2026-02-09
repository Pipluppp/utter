# 07 - Qwen Generate Task Flow

## Goal

Keep the current task-based generate API while implementing qwen-mode synthesis via internal realtime WebSocket orchestration.

## In Scope

- `POST /api/generate` qwen-mode orchestration.
- `GET /api/tasks/:id` behavior for qwen tasks.
- Finalization and cancellation semantics.

## Out of Scope

- New stream endpoint behavior (task 08).
- Frontend UX branching logic (task 09).

## Interfaces Impacted

- `POST /api/generate`
- `GET /api/tasks/:id`
- `POST /api/tasks/:id/cancel`

## Files/Modules Expected to Change

- `supabase/functions/api/routes/generate.ts`
- `supabase/functions/api/routes/tasks.ts`
- `supabase/functions/_shared/tts/providers/qwen_realtime.ts`
- `supabase/functions/_shared/tts/providers/qwen_audio.ts`

## Step-by-Step Implementation Notes

1. Keep request validation and response shape of `POST /api/generate` unchanged.
- Enforce `text.length <= 2000` and return `400` on overflow.

2. In qwen mode, generation preconditions:
- Voice exists and belongs to user.
- Voice has `tts_provider='qwen'`.
- Voice has non-null `provider_voice_id` and `provider_target_model`.
- `provider_target_model` is one of the pinned models for this rollout:
- `qwen3-tts-vc-realtime-2026-01-15` for cloned voices.
- `qwen3-tts-vd-realtime-2026-01-15` for designed voices.

3. Create generation + task rows as today, but set provider fields:
- task `provider='qwen'`
- generation `tts_provider='qwen'`

4. Start background synthesis using `EdgeRuntime.waitUntil`.

5. Qwen realtime synthesis protocol (grounded in `docs/qwen-api.md`):
- Open WS to realtime endpoint with `model=<provider_target_model>`.
- Send `session.update` with voice and output format (`response_format: \"mp3\"`).
- Send `input_text_buffer.append` with requested text.
- Send `session.finish`.
- Decode each `response.audio.delta` chunk.
- On terminal events (`response.done`, `session.finished`), finalize file upload and rows.

6. Task status model in qwen mode:
- `pending` -> `processing` -> `completed|failed|cancelled`
- `provider_status` examples: `ws_connecting`, `session_updated`, `streaming`, `finalizing`.

7. `GET /api/tasks/:id` in qwen mode reads DB state only.
- Do not poll Qwen provider APIs here.
- Return latest persisted task state and result.

8. Cancellation behavior:
- `POST /api/tasks/:id/cancel` marks cancellation requested.
- Worker checks cancellation state periodically and closes WS best effort.
- Final status should converge to `cancelled` with generation row updated.

9. Idempotent finalization guard:
- Only upload/store if generation audio key is null.
10. Throttling policy for this phase:
- Do not add extra per-user provider rate limits here.
- Credit-based enforcement is deferred to the billing/credit system.

## Data and Failure Modes

Failure modes:
1. WS connection fails before audio deltas.
- Mitigation: mark task/generation failed with provider error category.
2. Mid-stream disconnect.
- Mitigation: fail task and preserve diagnostic metadata (`request_id`, last event id).
3. Race in finalization with repeated task polls.
- Mitigation: idempotent DB guard (`audio_object_key is null`).
4. Cancellation arrives after completion.
- Mitigation: terminal state precedence rules.

## Validation Checks

### Preconditions

- Tasks 03-06 completed.
- Qwen secrets and target models configured.

### Command list

```bash
npm run test:edge
rg -n "session.update|input_text_buffer.append|response.audio.delta|session.finished" supabase/functions
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

- `/api/tasks/:id` tries calling Qwen status API.
- Completed task has no persisted audio key.
- Cancel endpoint reports success but generation remains processing indefinitely.

## Exit Criteria

- v1 task flow works in qwen mode with WS internals.
- Task endpoint remains backward compatible and deterministic.

## Rollback Note

Switch provider mode to Modal and redeploy API function. See `docs/qwen-integration/restoration.md`.
