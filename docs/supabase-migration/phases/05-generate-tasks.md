# Phase 05 — Generate + Task Orchestration

> **Status**: Complete
> **Prerequisites**: [Phase 04](./04-write-endpoints.md) complete
> **Goal**: Implement Modal integration with poll-driven finalization. This replaces FastAPI's background polling with an on-demand pattern where each frontend poll triggers one Modal status check.

---

## Why this phase exists

This is the core TTS pipeline. Edge Functions can’t run long background loops, so `/api/tasks/:id` becomes the “driver”: each poll performs exactly one Modal status check and (when ready) finalizes by uploading audio to Storage and updating DB rows.

---

## Steps

### 1. Create the Modal HTTP client

- [x] Create `supabase/functions/_shared/modal.ts`

**Verified against** `backend/services/tts_qwen.py`:
- Submit payload uses `ref_audio_base64` + `ref_text`
- Status/result use `?job_id=...`
- Cancel (optional) is `POST` JSON `{ job_id }`

### 2. Create `routes/generate.ts`

- [x] Create `supabase/functions/api/routes/generate.ts`
- [x] Mount in `supabase/functions/api/index.ts`

### 3. Implement `POST /generate`

- [x] Validate input (`voice_id`, `text` up to 10,000 chars, `language`)
- [x] Verify voice via user-scoped SELECT (RLS)
- [x] Download reference audio from Storage and base64 encode
- [x] Insert `generations` row (`status='processing'`)
- [x] Insert `tasks` row and submit Modal job
- [x] Update task with `modal_job_id` and `status='processing'`

### 4. Implement Modal polling + finalization in `GET /tasks/:id`

- [x] One poll → one Modal status check
- [x] Atomically increment `modal_poll_count` (DB helper function + RPC)
- [x] On completion: upload audio to Storage (upsert), update generation + task (idempotent guard via `audio_object_key is null`)
- [x] Task result contains stable URL: `{ audio_url: "/api/generations/:id/audio" }`

### 5. Implement `POST /tasks/:id/cancel`

- [x] Best-effort Modal cancellation (no-op if cancel endpoint unset)
- [x] Mark task `cancelled` and update generation `cancelled`

### 6. Implement `POST /generations/:id/regenerate`

- [x] Return `RegenerateResponse` including `redirect_url` with prefilled query params (matches FastAPI behavior)

---

## Files created

| File | Purpose |
|------|---------|
| `supabase/functions/_shared/modal.ts` | Modal HTTP client (submit, status, result, cancel) |
| `supabase/functions/api/routes/generate.ts` | `POST /generate` |
| `supabase/migrations/20260207195500_task_poll_count.sql` | RPC helper for atomic `modal_poll_count` increments |

## Files modified

| File | Change |
|------|--------|
| `supabase/functions/api/index.ts` | Mount generate routes |
| `supabase/functions/api/routes/tasks.ts` | Modal polling + finalization + cancel |
| `supabase/functions/api/routes/generations.ts` | Add regenerate endpoint |

---

## Acceptance criteria

- [x] `POST /api/generate` creates generation + task rows and returns `GenerateResponse`
- [x] `GET /api/tasks/:id` triggers Modal status check and increments `modal_poll_count`
- [x] Completed Modal job triggers finalization: audio uploaded to Storage, generation updated, task completed
- [x] Finalization is idempotent: concurrent polls don’t break or double-create rows
- [x] `POST /api/tasks/:id/cancel` cancels the task and (best-effort) the Modal job
- [x] `POST /api/generations/:id/regenerate` returns correct `RegenerateResponse`
- [x] Full flow: Generate → poll → audio plays → appears in History
- [x] Page refresh during generation: polling resumes, generation completes normally (state is in DB)

---

## Notes

- Local testing requires `supabase functions serve api --env-file ./supabase/.env.local` so the function can read `MODAL_JOB_*` endpoints.
