# 02 - API Contracts

## Goal

Define backward-compatible v1 contracts for non-streaming generation, including status and error normalization across Modal and Qwen.

## In Scope

- `POST /api/generate` (v1 task contract).
- `GET /api/tasks/:id` (v1 status source).
- Additive type changes for `Voice`, `BackendTask`, and `LanguagesResponse`.

## Out of Scope

- Database DDL details.
- Realtime/WebSocket/SSE contracts.
- Frontend render states beyond contract dependencies.

## Interfaces Impacted

- `POST /api/generate`
- `GET /api/tasks/:id`
- `POST /api/tasks/:id/cancel`
- `GET /api/languages`

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

3. Non-streaming-only rule.
- Do not add `POST /api/generate/stream`.
- All provider generation uses task mode (`/api/generate` + `/api/tasks/:id`).

4. Input cap policy (must match frontend copy and validation).
- `POST /api/generate`: reject over `QWEN_MAX_TEXT_CHARS` (default 600 for Qwen).
- Error detail should be explicit: `Text cannot exceed <N> characters`.

5. Extend `LanguagesResponse` capability model for non-streaming mode.

```json
{
  "provider": "qwen",
  "capabilities": {
    "supports_generate": true,
    "supports_generate_stream": false,
    "default_generate_mode": "task",
    "allow_generate_mode_toggle": false
  }
}
```

6. Additive type contract changes.
- `Voice` adds: `tts_provider`, `provider_voice_id`, `provider_target_model`, `provider_voice_kind`.
- `BackendTask` adds: `provider`, `provider_status`, `provider_poll_count` (while keeping `modal_*` fields during transition).
- `LanguagesResponse` adds non-streaming capabilities fields as above.

7. Voice delete contract update (behavioral, route unchanged).
- Keep `DELETE /api/voices/:id` external path and response shape.
- Implement app-level soft delete (`deleted_at`) and filter deleted voices from all user-facing list/select queries.
- Do not call Qwen provider delete API on user delete in this phase.

8. Error normalization rules.
- Always return `{ "detail": "..." }` for user-facing errors.
- Map provider-specific failures to stable categories (`validation`, `provider_unavailable`, `provider_rejected`, `timeout`, `cancelled`).

## Data and Failure Modes

Failure modes:
1. Contract drift breaks frontend assumptions.
- Mitigation: additive fields only in v1.
2. Ambiguous provider state in task payload.
- Mitigation: always emit `provider` and `provider_status` in active tasks.
3. Frontend sends stream-mode assumptions.
- Mitigation: enforce non-streaming capabilities in `/api/languages`.

## Validation Checks

### Preconditions

- Routes compiled and served by Supabase edge runtime.
- Frontend types updated for additive fields.

### Command list

```bash
curl -s http://127.0.0.1:54321/functions/v1/api/languages
curl -s -X POST http://127.0.0.1:54321/functions/v1/api/generate -H "content-type: application/json" -d '{"voice_id":"<uuid>","text":"hello","language":"English"}'
```

### Expected success output/state

- v1 responses remain unchanged for existing consumers.
- v1 task payload includes additive provider-neutral fields.
- `/api/languages` reports non-streaming capability (`supports_generate_stream=false`).

### Failure signatures

- Frontend fails parsing v1 response due to breaking field changes.
- `/api/languages` capability fields missing or inconsistent with mode.

## Exit Criteria

- v1 backward compatibility is verified.
- Non-streaming-only contract is documented and testable.
- Error mapping is deterministic across providers.

## Rollback Note

If qwen-mode behavior introduces instability, switch provider mode by env and use Modal flow. See `docs/qwen-integration/restoration.md`.
