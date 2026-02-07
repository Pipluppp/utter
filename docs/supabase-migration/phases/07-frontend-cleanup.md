# Phase 07 — Frontend Cleanup

> **Status**: Not Started
> **Prerequisites**: [Phase 06](./06-voice-design.md) complete
> **Goal**: Remove all legacy FastAPI code paths from the frontend. After this phase, the SPA works entirely against Supabase with no FastAPI remnants.

---

## Why this phase exists

Phases 01-06 built the Supabase backend and made one frontend change (Clone.tsx). But there are several legacy patterns still in the frontend that reference FastAPI-era behavior: the dev user ID bypass, unauthenticated task deletion, old audio paths, and static asset proxying.

---

## Steps

### 1. Remove `x-utter-user-id` dev bypass

**File**: `frontend/src/lib/api.ts` (lines 36-44)

**What to change**: Delete the entire `if (import.meta.env.DEV)` block in `getDefaultAuthHeaders()`.

**Current code**:
```typescript
async function getDefaultAuthHeaders(): Promise<Record<string, string>> {
  const session = await getSession()
  const accessToken = session?.access_token ?? null
  const headers: Record<string, string> = {}

  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  if (import.meta.env.DEV) {                    // DELETE this block
    const debugUserId = (                        // DELETE
      import.meta.env.VITE_DEBUG_USER_ID         // DELETE
    )?.trim().toLowerCase()                      // DELETE
    const userId = debugUserId || session?.user?.id  // DELETE
    if (userId) headers['x-utter-user-id'] = userId  // DELETE
  }                                              // DELETE

  return headers
}
```

**After**:
```typescript
async function getDefaultAuthHeaders(): Promise<Record<string, string>> {
  const session = await getSession()
  const accessToken = session?.access_token ?? null
  const headers: Record<string, string> = {}

  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  return headers
}
```

**Why**: Supabase Auth is the sole identity source. No dev bypass headers should exist — they're a security risk and don't work with Edge Functions anyway.

**Test**: Sign in → all API calls succeed without `x-utter-user-id` header. Check Network tab to verify the header is absent.

### 2. Fix TaskProvider unauthenticated DELETE

**File**: `frontend/src/components/tasks/TaskProvider.tsx` (line 136)

**What to change**: Replace raw `fetch()` with `apiJson()` to include auth headers.

**Current code**:
```typescript
const clearTask = useCallback(
  (taskType: TaskType) => {
    const task = state.tasks[taskType]
    if (task?.taskId) {
      fetch(`/api/tasks/${task.taskId}`, { method: 'DELETE' }).catch(() => {})
    }
    // ...
  },
  [state.tasks],
)
```

**After**:
```typescript
import { apiJson } from '../../lib/api'

const clearTask = useCallback(
  (taskType: TaskType) => {
    const task = state.tasks[taskType]
    if (task?.taskId) {
      apiJson(`/api/tasks/${task.taskId}`, { method: 'DELETE' }).catch(() => {})
    }
    // ...
  },
  [state.tasks],
)
```

**Why**: The Edge Function requires auth on `DELETE /tasks/:id`. Without this fix, task cleanup silently 401s.

**Test**: Complete a generation → dismiss the task toast → check Network tab → DELETE request includes `Authorization` header and returns 200.

### 3. Update History audio paths

**File**: `frontend/src/pages/History.tsx`

**What to change**: If there are any hardcoded references to `/uploads/generated/...` audio paths, replace them with the stable API URL pattern `/api/generations/:id/audio`.

- [ ] Search `History.tsx` for `/uploads/` references
- [ ] Search for any audio URL construction that doesn't use `generation.audio_path`
- [ ] The API (Phase 03) already sets `audio_path = '/api/generations/' + id + '/audio'` in the response, so if `History.tsx` uses `generation.audio_path` correctly, no change may be needed

**What to verify**: Play audio on the History page → Network tab shows request to `/api/generations/:id/audio` (not `/uploads/...`).

### 4. Move static assets into frontend

**Goal**: Demo audio files and static examples currently live in `backend/static/`. Since FastAPI is going away, move them to `frontend/public/`.

- [ ] Check if `backend/static/examples/` and `backend/static/utter_demo/` exist and contain files
- [ ] If they do, copy them:
  ```
  backend/static/examples/**  →  frontend/public/static/examples/**
  backend/static/utter_demo/** →  frontend/public/static/utter_demo/**
  ```
- [ ] Verify URLs still work: `/static/examples/...` should be served by Vite's static file serving from `public/`
- [ ] The `/static` proxy was already removed in Phase 01

**Test**: If the landing page or any page references `/static/...` assets, they should still load.

### 5. Disable transcription UX for MVP

**File**: `frontend/src/pages/Clone.tsx`

**Goal**: When `/api/languages` reports `transcription.enabled = false`, hide or disable the record + transcribe UI in Clone.

- [ ] Check how Clone.tsx currently handles the transcription feature
- [ ] The `useLanguages()` hook (or equivalent) should already fetch `/api/languages`
- [ ] If `transcription.enabled` is `false`, disable the "Record" tab and any "Transcribe" buttons
- [ ] The upload + manual transcript path must remain functional

**What to verify**: Clone page shows upload mode. No "Record" or "Transcribe" buttons (or they're disabled/hidden). Manual transcript entry works.

### 6. Remove VITE_DEBUG_USER_ID env var

- [ ] Check `frontend/.env` and `frontend/.env.local` for `VITE_DEBUG_USER_ID`
- [ ] Remove it if present (it was used by the `x-utter-user-id` bypass we deleted in step 1)

### 7. Verify no remaining FastAPI references

- [ ] Search the frontend for any remaining references:
  ```
  grep -r "FASTAPI" frontend/src/
  grep -r "/uploads/" frontend/src/
  grep -r "x-utter-user-id" frontend/src/
  grep -r "localhost:8000" frontend/src/
  ```
- [ ] All results should be zero. If any remain, fix them.

---

## Files modified

| File | Change |
|------|--------|
| `frontend/src/lib/api.ts` | Remove `x-utter-user-id` dev bypass block |
| `frontend/src/components/tasks/TaskProvider.tsx` | Use `apiJson` for DELETE (authenticated) |
| `frontend/src/pages/History.tsx` | Ensure audio uses `/api/generations/:id/audio` paths |
| `frontend/src/pages/Clone.tsx` | Disable transcription UX when `transcription.enabled = false` |
| `frontend/.env` | Remove `VITE_DEBUG_USER_ID` if present |

## Files created/moved

| Action | Path |
|--------|------|
| Copy | `backend/static/**` → `frontend/public/static/**` (if applicable) |

---

## Acceptance criteria

- [ ] No `x-utter-user-id` header in any API request (verify in Network tab)
- [ ] Task deletion from TaskProvider includes `Authorization` header
- [ ] Audio playback on History page uses `/api/generations/:id/audio` (not `/uploads/...`)
- [ ] Clone page works in upload-only mode (no transcription UI or it's disabled)
- [ ] Static assets (if any) load from `frontend/public/static/`
- [ ] `grep -r "FASTAPI\|/uploads/\|x-utter-user-id\|localhost:8000" frontend/src/` returns nothing
- [ ] Full local stack works: `npm run sb:start` + `npm run sb:serve` + `npm --prefix frontend run dev` — no FastAPI needed

---

## Gotchas

- **`apiJson` returns parsed JSON**: The old `fetch().catch(() => {})` pattern didn't care about the response. With `apiJson`, you still `.catch(() => {})` for the fire-and-forget delete, but `apiJson` will throw on non-2xx responses. Make sure the catch handles that.
- **Static files might not exist**: The `backend/static/` directory may not have any files that the SPA actually references. Check before copying.
- **Clone.tsx transcription state**: The transcription disable might involve React state and conditional rendering. Look at how the component currently switches between "Record" and "Upload" modes.
