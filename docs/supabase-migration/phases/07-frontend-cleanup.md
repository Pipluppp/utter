# Phase 07 — Frontend Cleanup

> **Status**: Complete
> **Prerequisites**: [Phase 06](./06-voice-design.md) complete
> **Goal**: Remove all legacy FastAPI code paths from the frontend. After this phase, the SPA works entirely against Supabase with no FastAPI remnants.

---

## Steps

### 1. Remove `x-utter-user-id` dev bypass

- [x] Removed the dev-only `x-utter-user-id` injection from `frontend/src/lib/api.ts`
- [x] Removed `VITE_DEBUG_USER_ID` from frontend env templates

### 2. Fix TaskProvider unauthenticated DELETE

- [x] `frontend/src/components/tasks/TaskProvider.tsx` uses `apiJson()` for `DELETE /api/tasks/:id` so auth headers are included

### 3. Update History audio paths

- [x] Confirmed History playback uses `generation.audio_path` (`/api/generations/:id/audio`), not `/uploads/...`

### 4. Move static assets into frontend

- [x] Copied:
  - `backend/static/examples/**` → `frontend/public/static/examples/**`
  - `backend/static/utter_demo/**` → `frontend/public/static/utter_demo/**`

### 5. Disable transcription UX for MVP

- [x] `frontend/src/pages/Clone.tsx` hides the Record mode when `transcription.enabled === false`
- [x] Upload + manual transcript path remains functional

### 6. Verify no remaining FastAPI references

- [x] `FASTAPI`, `/uploads/`, `x-utter-user-id`, and `localhost:8000` are absent from `frontend/src`

---

## Files modified

| File | Change |
|------|--------|
| `frontend/src/lib/api.ts` | Remove `x-utter-user-id` dev bypass block |
| `frontend/src/components/tasks/TaskProvider.tsx` | Use `apiJson` for `DELETE /tasks/:id` |
| `frontend/src/pages/Clone.tsx` | Hide Record mode when transcription disabled |
| `frontend/.env.example` | Remove FastAPI parity vars |

## Files created/moved

| Action | Path |
|--------|------|
| Copy | `backend/static/**` → `frontend/public/static/**` |

---

## Acceptance criteria

- [x] No `x-utter-user-id` header in any API request
- [x] Task deletion includes `Authorization` header
- [x] History audio uses `/api/generations/:id/audio`
- [x] Clone works in upload-only mode when transcription disabled
- [x] Static assets load from `frontend/public/static/`
- [x] `rg -n "FASTAPI|/uploads/|x-utter-user-id|localhost:8000" frontend/src` returns no matches

