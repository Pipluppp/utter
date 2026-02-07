# Phase 06 — Voice Design

> **Status**: Complete
> **Prerequisites**: [Phase 05](./05-generate-tasks.md) complete
> **Goal**: Implement voice design preview (Modal-generated) and save designed voices. After this phase, the Design page is fully functional.

---

## Why this phase exists

Voice design is the last feature-complete endpoint group. It reuses the task polling infrastructure from Phase 05, but the Modal endpoint is synchronous-with-redirect/polling (not the job-based endpoints used for generation).

---

## Steps

### 1. Create `routes/design.ts`

- [x] Create `supabase/functions/api/routes/design.ts`
- [x] Mount in `supabase/functions/api/index.ts`

### 2. Implement `POST /voices/design/preview`

- [x] Create a `design_preview` task row with metadata `{ text, language, instruct }`
- [x] Return `{ task_id, status: 'pending' }`
- [x] Do not return base64 in DB (preview audio is stored in Storage)

### 3. Implement `POST /voices/design`

- [x] Accept multipart form-data (`name`, `text`, `language`, `instruct`, `audio`)
- [x] Upload `audio` to Storage `references/${user_id}/${voice_id}/reference.wav`
- [x] Insert `voices` row with `source='designed'`, `description=instruct`, `reference_transcript=text`
- [x] Return voice metadata (plus `preview_url` for convenience)

### 4. Handle design preview finalization in `GET /tasks/:id`

- [x] When `type='design_preview'` and task is not terminal:
  - Claim work (pending → processing)
  - Call `MODAL_ENDPOINT_VOICE_DESIGN` using redirect/poll handling
  - Upload preview audio to Storage `references/${user_id}/preview_${task_id}.wav`
  - Update task to `completed` with `result.audio_url` (signed URL)

### 5. Update the frontend Design page

- [x] `frontend/src/pages/Design.tsx` consumes `task.result.audio_url` and fetches the audio blob for playback + saving
- [x] Backwards compatible with legacy `{ audio_base64 }` results (optional)

---

## Files created

| File | Purpose |
|------|---------|
| `supabase/functions/api/routes/design.ts` | `POST /voices/design/preview`, `POST /voices/design` |

## Files modified

| File | Change |
|------|--------|
| `supabase/functions/_shared/modal.ts` | Add `designVoicePreviewBytes()` with redirect/poll handling |
| `supabase/functions/api/index.ts` | Mount design routes |
| `supabase/functions/api/routes/tasks.ts` | Add `design_preview` finalization branch |
| `frontend/src/pages/Design.tsx` | Use Storage-backed `audio_url` |

---

## Acceptance criteria

- [x] `POST /api/voices/design/preview` creates a task and returns `{ task_id, status }`
- [x] Design preview audio plays in the SPA after task completes
- [x] Preview audio is stored in Storage (not as base64 in the DB)
- [x] `POST /api/voices/design` saves the voice with `source='designed'`
- [x] Saved voice appears in Voices list with correct metadata
- [x] Saved voice can generate speech via `POST /api/generate`
- [x] Saved voice preview plays via `GET /api/voices/:id/preview`

