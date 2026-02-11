# 08 - Qwen Non-Streaming Finalization

## Goal

Finalize the non-streaming qwen generation pipeline so provider output URLs are reliably converted into durable stored audio artifacts for replay/history.

## In Scope

- Non-streaming provider output handling.
- Temporary URL download and storage upload behavior.
- Generation/task metadata finalization.

## Out of Scope

- Realtime streaming endpoint implementation.
- Frontend live playback behavior.

## Interfaces Impacted

- `POST /api/generate` (existing task mode only)
- `GET /api/tasks/:id`
- storage persistence path for generated audio

## Files/Modules Expected to Change

- `supabase/functions/api/routes/generate.ts`
- `supabase/functions/_shared/tts/providers/qwen_synthesis.ts`
- `supabase/functions/_shared/tts/providers/qwen_audio.ts`
- generation persistence helpers

## Step-by-Step Implementation Notes

1. Provider synthesis contract.
- Use non-streaming HTTP synthesis only.
- Read `output.audio.url`, `output.audio.id`, `output.audio.expires_at`, `request_id`.

2. Download behavior.
- Download provider URL immediately after synthesis success.
- Use bounded retries for transient fetch failures.
- Treat expired URL as terminal provider failure and mark task failed.

3. Persistence behavior.
- Upload downloaded bytes into app storage bucket.
- Save durable object path in generation row.
- Save provider metadata (`request_id`, `audio_id`, `expires_at`) for diagnostics.

4. Status progression.
- `provider_synthesizing` -> `provider_downloading` -> `provider_persisting` -> terminal state.

5. Idempotency guard.
- If generation row already has durable audio object key, skip duplicate upload.

6. Error policy.
- Provider error: fail task with normalized provider category.
- Download error: fail task with URL/transport context.
- Upload error: fail task with storage context.

## Data and Failure Modes

Failure modes:
1. Provider returns success but URL download fails repeatedly.
- Mitigation: bounded retries, then terminal fail.
2. URL expiry race under slow workers.
- Mitigation: immediate handoff to download step, no deferred fetch.
3. Upload succeeds but DB update fails.
- Mitigation: retry DB write and log orphaned object for reconciliation.

## Validation Checks

### Preconditions

- Task 07 implemented.
- Storage bucket write permissions verified.

### Command list

```bash
npm run test:edge
rg -n "output\.audio\.url|expires_at|provider_audio_id|provider_audio_expires_at" supabase/functions
```

Manual smoke:

```bash
# 1) POST /api/generate (qwen mode)
# 2) Poll /api/tasks/:id until completed
# 3) Verify durable object path is set
# 4) Confirm playback uses durable URL, not provider temporary URL
```

### Expected success output/state

- Qwen task completes with durable stored audio object.
- Generation rows contain provider trace metadata and storage path.
- Final playback works after provider URL expiry window.

### Failure signatures

- Generation is marked completed while durable audio path is missing.
- Final playback still depends on temporary provider URL.
- Repeated duplicate uploads for same generation.

## Exit Criteria

- Non-streaming qwen outputs are persisted reliably and replayable.
- Finalization is idempotent and observable.

## Rollback Note

If finalization becomes unstable, force provider mode to Modal while investigating. See `docs/qwen-integration/restoration.md`.
