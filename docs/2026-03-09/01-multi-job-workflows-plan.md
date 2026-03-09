# Multi-Job Workflows Plan

## Goal

Allow multiple long-running jobs to coexist safely and give users a single, credible place to monitor them across the app.

This plan covers queue-backed async work only.

## Product decision

### Include now

- `generate`
- `design_preview`

These already use the task table and queue-first execution.

### Exclude for phase 1

- `clone finalize`

`clone/finalize` is still synchronous in `workers/api/src/routes/clone.ts`. It should not be force-fit into the multi-job feed until the backend itself becomes a task-backed operation.

## Current gaps

### Backend

- `workers/api/src/routes/generate.ts` blocks the second active generation
- there is no per-user concurrency policy other than "only one"
- `workers/api/src/routes/tasks.ts` has no list endpoint
- task metadata is enough for polling a single task, not for a rich activity feed

### Frontend

- `frontend/src/components/tasks/TaskProvider.tsx` stores one task per type
- local storage keys are type-based, so the next task overwrites the previous one
- `frontend/src/components/tasks/TaskDock.tsx` shows at most one task row per type
- `frontend/src/pages/Generate.tsx` and `frontend/src/pages/Design.tsx` assume a singular current task
- there is no dedicated job center page or panel

## Implementation shape

## Phase A: backend concurrency rules

### Generate policy

Replace the hard single-active check with a cap-based query.

Recommended starting policy:

- free tier: max 2 active queue-backed jobs total
- paid tier: max 4 active queue-backed jobs total
- hard floor: at least 1 queue-backed job always allowed

Track both:

- total active queue-backed tasks
- active tasks by type

Return a clear `409` only when the cap is exceeded.

### Design preview policy

Design preview should participate in the same active-task cap. It is already queue-backed and cancellable, so the right model is shared orchestration, not separate ad hoc behavior.

## Phase B: tasks feed contract

Add `GET /api/tasks` with filters and a stable sort.

Recommended query params:

- `status=active|terminal|all`
- `limit`
- `cursor` or `before`

Recommended response fields per task:

- `id`
- `type`
- `status`
- `created_at`
- `completed_at`
- `provider`
- `provider_status`
- `generation_id`
- lightweight display metadata:
  - `title`
  - `subtitle`
  - `language`
  - `voice_name`
  - `text_preview`
  - `estimated_duration_minutes`

Do not make the frontend reconstruct display rows from raw task internals.

## Phase C: frontend task-state refactor

Replace the singular type map with an id-keyed collection.

Recommended shape:

```ts
type TaskStore = {
  byId: Record<string, StoredTask>
  orderedIds: string[]
}
```

Keep task type as metadata, not as the storage key.

Required changes:

- migrate local storage from type-keyed entries to a single collection key
- allow multiple tasks with the same `type`
- keep polling keyed by `taskId`, not `taskType`
- preserve dismiss/cancel/clear per task id

## Phase D: cross-page UX

### Task dock

Upgrade the dock from a one-row-per-type summary into a compact stack of the most relevant jobs.

Rules:

- show all active tasks
- show terminal tasks until dismissed or TTL expiry
- group by recency, not by type
- keep per-task cancel where supported

### Job center

Add a dedicated job center surface reachable from anywhere in the app.

Recommended MVP:

- route: `/tasks`
- tabs: `Active`, `Recent`
- filters: `All`, `Generate`, `Design`
- actions: `Open source page`, `Cancel`, `Dismiss`

History remains the output archive. The job center is the live orchestration surface.

## Phase E: feature-page integration

### Generate page

- submitting a new request must not wipe an older tracked generation
- terminal result handling must target the specific completed task, not a singleton `tasks.generate`
- recent completions should link to History or inline audio when appropriate

### Design page

- preview tasks should be tracked independently by task id
- saving a designed voice should bind to the chosen completed preview task
- the UI should clearly distinguish between "preview still running" and "save this completed preview"

## Data migration and compatibility

Support one transition release that:

1. reads the legacy per-type storage keys
2. converts them to the new collection format
3. removes the legacy keys

Do not silently drop in-flight tasks during migration.

## Testing

### Backend

- concurrent `POST /generate` requests under cap succeed
- requests above cap fail with deterministic messaging
- `GET /api/tasks` returns the user-scoped active list and recent terminal list
- cancellation only affects the requested task id

### Frontend

- two generate tasks can render together in the dock and job center
- generate and design tasks can run together
- refresh and cross-tab sync preserve the collection
- terminal completion does not overwrite another task

## Acceptance criteria

1. A user can run more than one generation at the same time.
2. A user can run generation and design preview at the same time.
3. The frontend can track multiple tasks of the same type without overwriting.
4. The app exposes a list feed for active and recent tasks.
5. Users can see, dismiss, and cancel individual tasks from a shared job surface.

## Session checklist

- [ ] Remove the single-active generate restriction in `workers/api/src/routes/generate.ts`
- [ ] Define and implement the active-task cap policy for queue-backed jobs
- [ ] Add `GET /api/tasks` with stable filtering for active and recent jobs
- [ ] Refactor `frontend/src/components/tasks/TaskProvider.tsx` to an id-keyed collection model
- [ ] Migrate legacy per-type local task storage to the new collection format
- [ ] Update `TaskDock`, `Generate`, and `Design` to support multiple tracked tasks
- [ ] Add a first-pass job center surface or route for cross-page tracking
- [ ] Run relevant tests and leave the doc updated with anything deferred

## Manual verification checklist

- [ ] Start two generation jobs back to back and confirm both remain visible
- [ ] Start a generation and a design preview together and confirm both are tracked
- [ ] Refresh the page and confirm active tasks rehydrate correctly
- [ ] Cancel one active task and confirm only that task is affected
- [ ] Confirm completed and failed tasks show the correct final state

## Session prompt

```md
Work only on the multi-job workflows task for Utter.

Read:
- `AGENTS.md`
- `docs/2026-03-09/00-triage-and-branching.md`
- `docs/2026-03-09/01-multi-job-workflows-plan.md`

Task:
- Implement the multi-job plan end-to-end.
- Allow multiple concurrent queue-backed jobs, at minimum for `generate` and `design_preview`.
- Remove the frontend assumption that only one task can exist per type.
- Add the tasks list feed and the first usable job-tracking surface.

Constraints:
- Keep this session scoped to this task only.
- Do not start the loading skeleton, pricing, legal, copy, or visual-language tasks in this session unless strictly required for this task to function.
- Preserve queue-first behavior and explicit error handling.

Definition of done:
- Code is implemented.
- Relevant tests are run where possible.
- The plan doc is updated with any deviations, follow-ups, or unfinished edges.
- Summarize exactly what I should manually test locally before moving to the next task in a new chat.
```
