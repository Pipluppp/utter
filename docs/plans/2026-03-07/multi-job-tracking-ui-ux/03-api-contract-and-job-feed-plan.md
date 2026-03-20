# Plan 03: API Contract for Job Feed

## Goal

Provide an efficient API for multi-job tracking UI while keeping existing contracts stable.

## Existing routes to preserve

1. `GET /api/tasks/:id` (read-only)
2. `POST /api/tasks/:id/cancel`
3. `DELETE /api/tasks/:id`

## Proposed additive route

1. `GET /api/tasks`
- Query params:
  - `status` (`active|terminal|all`)
  - `type` (optional)
  - `limit` (default 20, max 100)
  - `cursor` (for pagination)
- Response:
  - list of task summaries
  - pagination cursor

## Summary payload shape (proposal)

1. `id`, `type`, `status`, `created_at`, `updated_at`, `completed_at`
2. `provider_status`, `error`
3. lightweight `metadata` subset (`text_preview`, `voice_name`, `estimated_duration_minutes`)
4. optional links (`generation_audio_url` when completed and applicable)

## Implementation tasks

1. Add route handler in `workers/api/src/routes/tasks.ts`.
2. Query only current user tasks, newest first, with safe limit.
3. Keep response lightweight for frequent polling.
4. Add tests for:
- auth required
- user isolation
- filter behavior
- pagination correctness

## Acceptance criteria

1. Frontend can fetch active + recent jobs with one endpoint.
2. Existing task detail/cancel/delete routes keep behavior unchanged.
3. No cross-tenant leakage in list route.
