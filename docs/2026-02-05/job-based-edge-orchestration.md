# Job-Based Orchestration: Modal Jobs → Supabase Edge Functions

> **Date**: 2026-02-03  
> **Purpose**: Explain (1) how Utter’s current codebase uses Modal’s job-based spawn/poll pattern, and (2) how to port the same architecture to a Supabase Edge Functions backend (stateless runtime + Postgres + Storage).
>
> **Related**
> - Modal-side details: `modal_app/qwen3_tts/LONG_RUNNING_TASKS.md`
> - Deployment target: `docs/2026-02-02/deployment-architecture-plan.md`
> - Frontend migration context: `docs/2026-02-03/frontend-refactor/frontend-inventory.md`

---

## TL;DR

- **Modal jobs** (spawn/poll) make speech generation reliable for long runtimes and enable cancellation.
- In the current FastAPI backend, Utter uses jobs but still stores task state in an **in-memory TaskStore** (works locally, not durable).
- In a Supabase Edge Functions backend, you keep the Modal job pattern, but move task state to a **Postgres `tasks` table** and audio outputs to **Supabase Storage**.
- The recommended Edge pattern is **poll-driven finalization**:
  - `POST /generate` submits a Modal job and returns fast.
  - `GET /tasks/:id` polls Modal and *when complete* fetches the audio, uploads to Storage, and updates DB.

---

## Terminology

- **Utter `task_id`**: the ID returned to the frontend for progress/status checks.
- **Modal `job_id`**: the ID returned by Modal for a spawned job (`FunctionCall.object_id`).
- **Finalize**: the step where the orchestrator fetches the job result and persists it (Storage + DB).

---

## Current implementation (FastAPI + SQLite + local uploads)

### Where it lives

- Orchestration + API:
  - `backend/main.py`:
    - `POST /api/generate` creates a `Generation` row immediately, then creates a task in `TaskStore`, then starts `_process_generation(...)` in the background.
    - `GET /api/tasks/{task_id}` returns the in-memory task state (polled by frontend).
    - `POST /api/tasks/{task_id}/cancel` requests cancellation (generate only).
- Task state:
  - `backend/main.py`: `TaskStore` (in-memory dict with TTL cleanup).
- Modal client + job helpers:
  - `backend/services/tts.py` (orchestrator-facing API)
  - `backend/services/tts_qwen.py` (Modal calls, job submit/status/result, cancellation)
- Files:
  - Generated audio is written under local `backend/uploads/generated/` and served as `/uploads/generated/<filename>`.

### Current request flow (Generate)

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

### Background flow (job-based generation)

```
_process_generation(task_id, ...)
  |
  | submit Modal job  -> returns job_id
  | poll Modal status -> until completed/cancelled/failed
  | fetch Modal result (audio bytes)
  | write to backend/uploads/generated
  | update Generation row (audio_path, duration, status)
  | update TaskStore (status, result.audio_url, ...)
```

### Key limitation (why this must change for Edge Functions)

Modal job IDs survive backend restarts, but **Utter’s TaskStore does not**. On restart, the frontend can still have `task_id` in localStorage, but `/api/tasks/{task_id}` cannot recover state because it lived only in memory.

This is exactly the gap that Supabase Postgres (tasks table) is meant to fill.

---

## Modal implementation (job endpoints)

Modal provides a spawn/poll model via `FunctionCall` IDs.

Utter exposes job endpoints in `modal_app/qwen3_tts/app_06b.py` (see `modal_app/qwen3_tts/LONG_RUNNING_TASKS.md` for details):

- `POST /submit-job` → `{ job_id }`
- `GET /job-status?job_id=...` → `{ status: running|completed|failed }`
- `GET /job-result?job_id=...` → `audio/wav` (or 202 if not ready)

The important property: these endpoints are quick and safe to call from Edge Functions.

---

## Target implementation (Supabase-only backend)

### What changes (high level)

| Concern | Current (FastAPI local) | Target (Supabase-only) |
|---|---|---|
| Task state | In-memory `TaskStore` | Postgres `tasks` table (+ Realtime optional) |
| Audio files | Local `/uploads/**` | Supabase Storage buckets + signed URLs |
| Orchestration runtime | Background `asyncio` task | Edge Functions (stateless) + DB state machine |

### Recommended Edge pattern: poll-driven finalization

Instead of trying to “run generation” inside Edge (even with `waitUntil()`), treat Edge as an orchestrator that performs **small bounded work** per request.

#### Endpoints (conceptual)

```text
POST   /generate         → create task + submit Modal job → return {task_id}
GET    /tasks/:id        → poll Modal → maybe finalize/upload → return task(+result)
POST   /tasks/:id/cancel → cancel Modal job + mark cancelled
```

This pattern works even if:
- the Edge worker is restarted mid-flight,
- the user refreshes,
- multiple clients poll the same task,
because the canonical state is in Postgres.

---

## Data model (minimum viable)

### `tasks` table (Postgres)

Required fields:
- `id` (uuid, PK)
- `user_id` (uuid, FK to auth.users)
- `type` (`generate` | `design` | `clone`)
- `status` (`pending` | `processing` | `completed` | `failed` | `cancelled`)
- `metadata` (jsonb) — includes `modal_job_id`, `voice_id`, `generation_id`, `text_length`, etc.
- `result` (jsonb) — includes `audio_path` (storage key) or `audio_url` (signed URL), duration, etc.
- `error` (text)
- `created_at`, `updated_at`, `completed_at`

Optional but useful:
- `cancel_requested_at` (timestamp) to coordinate cancellation idempotently.

### Storage buckets

- `references/` (private): `{user_id}/{voice_id}/reference.wav`
- `generations/` (private): `{user_id}/{generation_id}.wav`

---

## Edge Function behavior (decision-complete)

### 1) `POST /generate`

1. Auth: derive `user_id` from JWT (no service role).
2. Validate request body (voice_id/text/language).
3. Create `Generation` row (`status=processing`) (optional but recommended for “history while processing” parity).
4. Create `tasks` row (`status=pending`, include `generation_id` in metadata).
5. Fetch reference audio + reference transcript (from DB + Storage).
6. Call Modal `submit-job` (fast) → `modal_job_id`.
7. Update task:
   - `status=processing`
   - `metadata.modal_job_id = ...`
8. Return `{ task_id, generation_id, status: 'processing' }`.

### 2) `GET /tasks/:id` (poll + finalize)

1. Auth: verify user owns the task (RLS).
2. Read task row.
3. If terminal (`completed|failed|cancelled`): return as-is.
4. If missing `metadata.modal_job_id`: mark failed (invalid state) and return.
5. Call Modal `job-status`:
   - If running: update `updated_at` (optional), return `processing`.
   - If failed: update task status failed + error; update generation failed; return.
   - If completed:
     - If result already populated (idempotency): return.
     - Fetch Modal `job-result` (audio bytes).
     - Upload to Supabase Storage at deterministic key (`generations/{user_id}/{generation_id}.wav`).
     - Update generation row with `audio_path`, `status=completed`, duration metadata if available.
     - Update task row with `status=completed`, `result.audio_path=...`, `completed_at=now`.
     - Return updated task.

**Idempotency rule**
- Finalization must be safe if two clients poll simultaneously:
  - Use one of:
    - a Postgres “finalizing” status + `UPDATE ... WHERE status='processing' AND result IS NULL` guard, or
    - a DB function / transaction with row-level lock.

### 3) `POST /tasks/:id/cancel`

1. Auth + ownership.
2. If already terminal: return current.
3. If `metadata.modal_job_id` exists: call Modal cancel endpoint (best-effort).
4. Mark task cancelled in DB and update generation cancelled/failed accordingly.

---

## Frontend implications (React migration)

The React refactor can keep the current UX contract:
- “start task → poll task → render progress → show result”

But the backend contract should move from:
- “poll an in-memory TaskStore”
to:
- “poll a DB-backed task row (or subscribe via Realtime)”

Practical guidance:
- Keep localStorage keys and task object shape stable where possible.
- Prefer `GET /tasks/:id` returning a normalized shape similar to today’s `/api/tasks/{id}` response.
- Optionally add Supabase Realtime subscription later to reduce polling.

---

## Suggested reading order

1) `modal_app/qwen3_tts/LONG_RUNNING_TASKS.md` (Modal job mechanics)  
2) `docs/2026-02-02/deployment-architecture-plan.md` (overall target system)  
3) This doc (bridge: current → Edge implementation details)  

