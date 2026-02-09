# 02 - API Contracts

## Goal

Define backward-compatible v1 contracts and the new v2 streaming contract, including status and error normalization across Modal and Qwen.

## In Scope

- `POST /api/generate` (v1 task contract).
- `GET /api/tasks/:id` (v1 status source).
- `POST /api/generate/stream` (v2 streaming contract).
- Additive type changes for `Voice`, `BackendTask`, and `LanguagesResponse`.

## Out of Scope

- Database DDL details.
- WebSocket low-level implementation details.
- Frontend render states beyond contract dependencies.

## Interfaces Impacted

- Existing:
- `POST /api/generate`
- `GET /api/tasks/:id`
- `POST /api/tasks/:id/cancel`
- `GET /api/languages`
- New:
- `POST /api/generate/stream`

## Files/Modules Expected to Change

- `supabase/functions/api/routes/generate.ts`
- `supabase/functions/api/routes/tasks.ts`
- `supabase/functions/api/routes/languages.ts`
- `frontend/src/lib/types.ts`
- `frontend/src/pages/Generate.tsx`

## Step-by-Step Implementation Notes

1. Keep v1 `POST /api/generate` response shape stable:

```json
{
  "task_id": "uuid",
  "status": "processing",
  "is_long_running": true,
  "estimated_duration_minutes": 2.4,
  "generation_id": "uuid"
}
```

2. Keep v1 `GET /api/tasks/:id` as the canonical task state endpoint.
- Preserve existing modal fields during transition: `modal_status`, `modal_elapsed_seconds`, `modal_poll_count`.
- Add provider-neutral fields: `provider`, `provider_status`, `provider_poll_count`.

3. Introduce v2 `POST /api/generate/stream`.
- Available only in qwen mode.
- Request body matches v1 generate input (`voice_id`, `text`, `language`).
- Enforce `text.length <= 2000`.
- Response: chunked `audio/mpeg` stream.
- Include metadata headers:
- `X-Utter-Provider: qwen`
- `X-Utter-Generation-Id: <uuid>`
- `X-Utter-Task-Id: <uuid or empty>`

4. Modal mode behavior for v2 endpoint.
- Return `409` with JSON detail instructing caller to use v1 task contract.
5. Input cap policy (must match frontend copy and validation).
- `POST /api/generate`: reject over 2000 chars.
- `POST /api/generate/stream`: reject over 2000 chars.
- Error detail should be explicit: `Text cannot exceed 2000 characters`.

6. Extend `LanguagesResponse` capability model.

```json
{
  "provider": "qwen",
  "capabilities": {
    "supports_generate_stream": true,
    "default_generate_mode": "stream",
    "allow_generate_mode_toggle": false
  }
}
```

For dev/staging environments with feature flag enabled, `allow_generate_mode_toggle` may be `true`.

7. Additive type contract changes.
- `Voice` adds: `tts_provider`, `provider_voice_id`, `provider_target_model`, `provider_voice_kind`.
- `BackendTask` adds: `provider`, `provider_status`, `provider_poll_count` (while keeping `modal_*` fields during transition).
- `LanguagesResponse` adds: `capabilities.supports_generate_stream`, `capabilities.default_generate_mode`, `capabilities.allow_generate_mode_toggle`.

8. Voice delete contract update (behavioral, route unchanged).
- Keep `DELETE /api/voices/:id` external path and response shape.
- Implement app-level soft delete (`deleted_at`) and filter deleted voices from all user-facing list/select queries.
- Do not call Qwen provider delete API on user delete in this phase.

9. Error normalization rules.
- Always return `{ "detail": "..." }` for user-facing errors.
- Map provider-specific failures to stable categories (`validation`, `provider_unavailable`, `provider_rejected`, `timeout`, `cancelled`).

## Data and Failure Modes

Failure modes:
1. Contract drift breaks frontend assumptions.
- Mitigation: additive fields only in v1.
2. Stream endpoint returns non-audio payload on partial failures.
- Mitigation: fail before streaming starts when possible.
3. Ambiguous provider state in task payload.
- Mitigation: always emit `provider` and `provider_status` in active tasks.

## Validation Checks

### Preconditions

- Routes compiled and served by Supabase edge runtime.
- Frontend types updated for additive fields.

### Command list

```bash
curl -s http://127.0.0.1:54321/functions/v1/api/languages
curl -s -X POST http://127.0.0.1:54321/functions/v1/api/generate -H "content-type: application/json" -d '{"voice_id":"<uuid>","text":"hello","language":"English"}'
curl -i -X POST http://127.0.0.1:54321/functions/v1/api/generate/stream -H "content-type: application/json" -d '{"voice_id":"<uuid>","text":"hello","language":"English"}'
```

### Expected success output/state

- v1 responses remain unchanged for existing consumers.
- v1 task payload includes additive provider-neutral fields.
- v2 endpoint streams audio in qwen mode and returns `409` in modal mode.

### Failure signatures

- Frontend fails parsing v1 response due to breaking field changes.
- Stream endpoint returns HTML/non-JSON errors.
- `/api/languages` capability fields missing or inconsistent with mode.

## Exit Criteria

- v1 backward compatibility is verified.
- v2 streaming contract is documented and testable.
- Error mapping is deterministic across providers.

## Rollback Note

If v2 introduces instability, disable stream route by env and use v1 only. See `docs/qwen-integration/restoration.md`.
