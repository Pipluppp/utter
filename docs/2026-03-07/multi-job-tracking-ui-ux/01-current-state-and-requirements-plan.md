# Plan 01: Current State and Requirements

## Goal

Lock requirements and constraints before changing backend concurrency and frontend state model.

## Current-state facts (from code)

1. `workers/api/src/routes/generate.ts` blocks when an active `generate` task exists.
2. DB migration `20260209113000_active_generate_guard.sql` enforces one active `generate` task per user.
3. `frontend/src/components/tasks/TaskProvider.tsx` stores tasks as `Partial<Record<TaskType, StoredTask>>`.
4. `TaskDock` and page flows (`Generate`, `Design`) assume one task per type.

## Requirements

1. Allow multiple active jobs per user (at least for generate; optionally design previews if product allows).
2. Preserve queue-first execution and cancellation terminal-safety.
3. Preserve existing per-job APIs (`GET /api/tasks/:id`, `POST /api/tasks/:id/cancel`, `DELETE /api/tasks/:id`).
4. Add a first-class job feed UX that complements History.

## Decisions to lock

1. Concurrency policy:
- default max active jobs per user (suggest initial cap: 3 generate jobs)
- whether cap differs by tier

2. Job feed scope:
- active only vs active + recent terminal (suggest active + last 50 terminal)
- retention window in client cache

3. UX entry points:
- global nav indicator
- persistent dock
- dedicated "Jobs" page/panel

## Deliverables

1. Product + engineering requirement note.
2. Concurrency and UX scope decisions with owner sign-off.

## Exit criteria

1. No ambiguous decisions remain on concurrency caps or UX scope.
