# 08 - Qwen Streaming v2

## Goal

Add `POST /api/generate/stream` for realtime audio playback in qwen mode while persisting generated audio for history and replay.

## In Scope

- New stream endpoint contract.
- Stream transport behavior and persistence rules.
- Fallback behavior by provider mode.

## Out of Scope

- Replacing v1 task contract.
- Non-Qwen streaming implementation.

## Interfaces Impacted

- New `POST /api/generate/stream`.
- Optional additive metadata in generation/task rows.

## Files/Modules Expected to Change

- `supabase/functions/api/routes/generate.ts` (or dedicated `generate_stream.ts` route)
- `supabase/functions/_shared/tts/providers/qwen_realtime.ts`
- `supabase/functions/_shared/tts/providers/qwen_audio.ts`
- frontend consume path (task 09)

## Step-by-Step Implementation Notes

1. Endpoint contract.
- Request body matches v1 generate input.
- Enforce `text.length <= 2000`.
- Only available in qwen mode.
- Modal mode returns `409` with clear fallback detail.

2. Response behavior.
- Content type: `audio/mpeg`.
- Use chunked transfer via `ReadableStream`.
- Include metadata headers:
- `X-Utter-Provider: qwen`
- `X-Utter-Generation-Id`
- `X-Utter-Task-Id` (if task row retained)

3. Internal flow.
1. Validate voice compatibility and text.
2. Start WS synthesis.
2a. Set `response_format: \"mp3\"` in `session.update`.
3. For each `response.audio.delta`:
- base64 decode
- enqueue bytes to client stream
- append bytes to persistence buffer
4. On terminal event:
- close stream
- upload final audio object
- update generation/task rows

4. Persistence policy.
- Persist successful stream outputs to `generations` bucket.
- Set generation status `completed` only after upload + DB update succeed.

5. Error handling.
- Errors before stream starts: return JSON `{ detail }`.
- Errors mid-stream: close stream and mark generation/task as failed.
- Capture provider request/event IDs in metadata.

6. Grounded protocol requirements from `docs/qwen-api.md`:
- Use `session.update`, `input_text_buffer.append`, `session.finish`.
- Expect `response.audio.delta` and terminal events.

## Data and Failure Modes

Failure modes:
1. Browser does not support progressive playback for chosen transport.
- Mitigation: frontend fallback to v1 task mode.
2. Mid-stream persistence failure.
- Mitigation: fail generation row with explicit error metadata.
3. Long text exceeds practical wall-clock envelope.
- Mitigation: hard 2000-char cap and timeout protection.

## Validation Checks

### Preconditions

- Task 07 qwen WS synthesis is stable.
- Frontend fallback logic defined (task 09).

### Command list

```bash
npm run test:edge
curl -i -N -X POST http://127.0.0.1:54321/functions/v1/api/generate/stream -H "content-type: application/json" -d '{"voice_id":"<uuid>","text":"hello world","language":"English"}' --output stream.mp3
```

### Expected success output/state

- Qwen mode: endpoint streams playable MP3 bytes and persists generation.
- Modal mode: endpoint returns `409` with fallback instruction.
- Generation history contains stream-created output.

### Failure signatures

- Endpoint blocks until full audio generation is complete (not streaming).
- Stream starts but generation row never transitions to terminal status.
- Modal mode accidentally attempts qwen stream path.

## Exit Criteria

- Realtime stream endpoint is available and reliable in qwen mode.
- Persistence and replay remain functional for streamed generations.

## Rollback Note

Disable stream route by env/capability and keep v1 generate path active. See `docs/qwen-integration/restoration.md`.
