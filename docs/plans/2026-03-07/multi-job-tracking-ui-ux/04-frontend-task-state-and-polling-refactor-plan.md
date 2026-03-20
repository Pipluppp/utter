# Plan 04: Frontend Task State and Polling Refactor

## Goal

Refactor client task state from "one per type" to "many per task id" with scalable polling and stable UX.

## Current limitation

`TaskProvider` stores tasks as `Record<TaskType, StoredTask>`, which overwrites previous tasks of same type.

## Target model

1. `tasksById: Record<string, StoredTask>`
2. Optional derived indexes:
- `activeTaskIds`
- `tasksByType`
- `recentTaskIds`

## Implementation tasks

1. Types and storage:
- Update `StoredTask` usage to require stable `taskId` for async jobs.
- Replace per-type localStorage keys with list/map storage format.
- Provide migration from legacy keys (`utter_task_generate`, etc.).

2. Provider API:
- Replace `startTask(taskId, taskType, ...)` to append, not overwrite.
- Update `dismissTask`, `cancelTask`, `clearTask` to operate by `taskId`.
- Keep convenience selectors by type for existing pages during migration.

3. Polling strategy:
- Poll active tasks by id with bounded concurrency (avoid N+1 thrash).
- Prefer list polling (`GET /api/tasks?status=active`) when available.
- Stop polling terminal tasks and apply retention policy.

4. Page integration:
- `Generate` and `Design` pages should bind to "latest task from this page" rather than singular type slot.
- Keep post-completion UX (audio readiness, save voice, etc.) per task instance.

## Acceptance criteria

1. Multiple generate tasks are visible and independently tracked.
2. No task overwrites due to same type.
3. Polling remains performant with several active jobs.
4. Legacy stored task data migrates without hard break.
