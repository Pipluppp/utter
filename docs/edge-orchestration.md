# Job-based orchestration: Modal jobs -> Supabase Edge Functions

Date: **2026-02-03**

Purpose:
1) Explain how Utter currently uses Modal's job-based spawn/poll pattern.
2) Define how we port the same architecture to a Supabase Edge Functions backend (stateless runtime + Postgres + Storage).

Related:
- Architecture (comprehensive reference): [`architecture.md`](./architecture.md)
- Modal-side details: `modal_app/qwen3_tts/LONG_RUNNING_TASKS.md`
- Billing + cost projections: [`deployment-architecture.md`](./deployment-architecture.md)
- Current behavior contracts: [`features.md`](./features.md)

---

## TL;DR

- Modal jobs (spawn/poll) make long-running TTS reliable and enable cancellation.
- Today, Utter still stores task state in an in-memory `TaskStore` (works locally, not durable).
- In a Supabase Edge Functions backend, keep the Modal job pattern but move task state to Postgres (`tasks` table) and audio outputs to Supabase Storage.
- Recommended Edge pattern: poll-driven finalization
  - `POST /generate` submits a Modal job and returns quickly.
  - `GET /tasks/:id` polls Modal and, when complete, finalizes (download -> Storage upload -> DB update).

---

## Terminology

- Utter `task_id`: the ID returned to the frontend for progress/status checks.
- Modal `job_id`: the ID returned by Modal for a spawned job.
- Finalize: fetch the job result and persist it (Storage + DB).

---

## Current implementation (FastAPI + SQLite + local uploads)

Where it lives:
- Orchestration + API:
  - `backend/main.py`:
    - `POST /api/generate` creates a `Generation` row, creates a task in `TaskStore`, starts `_process_generation(...)`.
    - `GET /api/tasks/{task_id}` returns the in-memory task state (polled by frontend).
    - `POST /api/tasks/{task_id}/cancel` requests cancellation.
- Task state:
  - `backend/main.py`: `TaskStore` (in-memory dict with TTL cleanup).
- Modal client + job helpers:
  - `backend/services/tts.py`
  - `backend/services/tts_qwen.py`
- Files:
  - generated audio is written under local `backend/uploads/generated/` and served as `/uploads/generated/<filename>`.

Request flow (Generate):
```
Frontend
  |
  | POST /api/generate
  v
FastAPI
  - create Generation(status=processing)
  - create TaskStore task (task_id)
  - asyncio.create_task(_process_generation(...))
  - return {task_id, generation_id}
  |
  | (poll)
  +--> GET /api/tasks/{task_id}  (reads TaskStore)
```

Key limitation:
- Modal job IDs survive backend restarts.
- Utter's TaskStore does not.
- On restart, the frontend can still have `task_id` in localStorage, but `/api/tasks/{task_id}` cannot recover state.

This is exactly the gap a Postgres `tasks` table fills.

---

## Target implementation (Supabase-only backend)

What changes:

| Concern | Current (FastAPI local) | Target (Supabase) |
|---|---|---|
| Task state | in-memory `TaskStore` | Postgres `tasks` table |
| Audio files | local `/uploads/**` | Storage buckets + signed URLs |
| Orchestration runtime | background `asyncio` | Edge Functions (stateless) + DB state machine |

### Storage conventions (recommended)

Buckets (private):
- `references`
- `generations`

Object keys (user-scoped):
- references: `<user_id>/<voice_id>/reference.wav`
- generations: `<user_id>/<generation_id>.wav`

### Minimum viable `tasks` data model

Required fields (see also `docs/database.md`):
- `id` (uuid, PK)
- `user_id` (uuid, FK to auth.users)
- `type` (`generate` | `design_preview` | `clone` | ...)
- `status` (`pending` | `processing` | `completed` | `failed` | `cancelled`)
- `modal_job_id` (text, nullable)
- `metadata` (jsonb) for request details
- `result` (jsonb) for output details (e.g., `audio_object_key`)
- `error` (text)
- timestamps (`created_at`, `updated_at`, `completed_at`)

Optional but useful:
- `cancellation_requested` boolean

---

## Edge function behavior (decision-complete)

### 1) `POST /generate`

1. Auth: derive `user_id` from JWT (RLS should apply).
2. Validate request body (voice_id/text/language).
3. Create `generations` row (`status=processing`).
4. Create `tasks` row (`status=pending`, link `generation_id`).
5. Call Modal `submit-job` (fast) -> `modal_job_id`.
6. Update task:
   - `status=processing`
   - `modal_job_id=...`
7. Return `{ task_id, generation_id, status: 'processing' }`.

### 2) `GET /tasks/:id` (poll + finalize)

1. Auth + ownership (RLS).
2. Read the task row.
3. If terminal (`completed|failed|cancelled`): return as-is.
4. If missing `modal_job_id`: mark failed (invalid state) and return.
5. Call Modal `job-status`:
   - If running: return `processing`.
   - If failed: update task failed + error; update generation failed; return.
   - If completed:
     - If already finalized (idempotency): return.
     - Fetch Modal `job-result` (audio bytes).
     - Upload to Storage at deterministic key (bucket `generations`, key `<user_id>/<generation_id>.wav`).
     - Update generation row: `audio_object_key`, `status=completed`, duration metadata if available.
     - Update task row: `status=completed`, `result.audio_object_key=...`, `completed_at=now`.
     - Return updated task.

Idempotency rule:
- Finalization must be safe if two clients poll simultaneously.
- Use a DB guard, for example:
  - a `finalizing` status transition with a conditional update, or
  - an RPC function that takes a row lock and finalizes in one transaction.

### 3) `POST /tasks/:id/cancel`

1. Auth + ownership (RLS).
2. If already terminal: return current.
3. If `modal_job_id` exists: call Modal cancel endpoint (best-effort).
4. Mark task cancelled in DB and update generation cancelled/failed accordingly.

---

## Frontend implications

The React app can keep the same UX contract:
- start task -> poll task -> render progress -> show result

But the backend contract moves from:
- "poll an in-memory TaskStore"
to:
- "poll a DB-backed task row (or subscribe via Realtime)"

Practical guidance:
- Keep `task_id` and response shapes stable where possible.
- Consider a later optimization: Supabase Realtime subscriptions for task updates to reduce polling.

---

## Suggested reading order

1) `modal_app/qwen3_tts/LONG_RUNNING_TASKS.md` (Modal job mechanics)
2) `docs/backend.md` + `docs/database.md` (how this maps to our API + schema)
3) This doc (poll-driven finalization details)

