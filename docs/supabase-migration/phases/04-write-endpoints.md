# Phase 04 — Write Endpoints (Clone + Deletes)

> **Status**: Complete
> **Prerequisites**: [Phase 03](./03-read-endpoints.md) complete
> **Goal**: Implement the clone voice 2-step upload flow and all delete endpoints. This is the first phase that writes to the database and modifies the frontend.

---

## Why this phase exists

Clone is the most significant API contract change in the migration (multipart → signed-URL upload). Getting it working early proves the Storage upload pipeline and validates the only frontend page that needs a structural change (`Clone.tsx`).

---

## Steps

### 1. Create `routes/clone.ts`

- [x] Create `supabase/functions/api/routes/clone.ts`
- [x] Mount in `index.ts`: `app.route('/', cloneRoutes)`

### 2. Implement `POST /clone/upload-url`

**Goal**: Validate clone metadata, generate a voice ID and Storage key, return a signed upload URL so the browser can upload directly to Storage.

**Request body**:
```typescript
{
  name: string,        // 1-100 chars
  language: string,    // e.g. 'English', 'Auto'
  transcript: string,  // Reference transcript (required by Qwen)
  description?: string // Optional
}
```

**Response** (new shape, no existing frontend type — Clone.tsx will be updated):
```typescript
{
  voice_id: string,
  upload_url: string,  // Signed Storage upload URL (short TTL, e.g. 5 min)
  object_key: string   // Storage path for reference
}
```

**Implementation steps**:
- [x] `requireUser()` → extract `user_id`
- [x] Validate `name` (1-100 chars, not empty)
- [x] Validate `language` (non-empty string)
- [x] Validate `transcript` (non-empty string — Qwen requires reference transcript)
- [x] Generate `voice_id = crypto.randomUUID()`
- [x] Compute `object_key = ${user_id}/${voice_id}/reference.wav`
- [x] Create signed upload URL via admin client:
  ```typescript
  const { data, error } = await adminClient.storage
    .from('references')
    .createSignedUploadUrl(object_key)
  ```
- [x] Return `{ voice_id, upload_url: data.signedUrl, object_key }`
- [x] Return errors as `{ detail: string }` with appropriate status codes

**Test**: `curl -X POST /api/clone/upload-url -H "Authorization: Bearer ..." -H "Content-Type: application/json" -d '{"name":"Test","language":"English","transcript":"Hello"}'` → should return a signed URL.

### 3. Implement `POST /clone/finalize`

**Goal**: After the browser uploads the audio file to Storage, this endpoint creates the `voices` row.

**Request body**:
```typescript
{
  voice_id: string,       // From upload-url step
  name: string,
  language: string,
  transcript: string,
  description?: string
}
```

**Response** (matches `CloneResponse`):
```typescript
{ id: string, name: string }
```

**Implementation steps**:
- [x] `requireUser()` → extract `user_id`
- [x] Validate all required fields
- [x] Verify the uploaded object exists in Storage:
  ```typescript
  const { data } = await adminClient.storage
    .from('references')
    .list(`${user_id}/${voice_id}`)
  // Check that reference.wav is in the listing
  ```
- [x] If object doesn't exist, return 400 `{ detail: 'Audio file not uploaded' }`
- [x] INSERT into `voices` via admin client:
  ```typescript
  const { data, error } = await adminClient
    .from('voices')
    .insert({
      id: voice_id,
      user_id,
      name,
      language,
      source: 'uploaded',
      reference_object_key: `${user_id}/${voice_id}/reference.wav`,
      reference_transcript: transcript,
      description: description || null,
    })
    .select('id, name')
    .single()
  ```
- [x] Return `{ id: data.id, name: data.name }`

**Test**: After getting a signed URL and uploading a .wav file, call finalize → voice should appear in `GET /voices`.

### 4. Update `Clone.tsx` for the 2-step flow

- [x] Edit `frontend/src/pages/Clone.tsx`

**Current flow** (single call):
```typescript
const response = await apiForm<CloneResponse>('/api/clone', formData)
```

**New flow** (3 steps):
```typescript
// Step 1: Get signed upload URL
const { voice_id, upload_url } = await apiJson<{
  voice_id: string
  upload_url: string
  object_key: string
}>('/api/clone/upload-url', {
  method: 'POST',
  json: { name, language, transcript, description },
})

// Step 2: Upload audio directly to Storage
const uploadRes = await fetch(upload_url, {
  method: 'PUT',
  body: audioBlob,  // The raw audio Blob/File
  headers: { 'Content-Type': 'audio/wav' },
})
if (!uploadRes.ok) {
  throw new Error('Failed to upload audio file')
}

// Step 3: Finalize the clone
const result = await apiJson<CloneResponse>('/api/clone/finalize', {
  method: 'POST',
  json: { voice_id, name, language, transcript, description },
})
```

**What to change in Clone.tsx**:
- [x] Find the submit handler that calls `apiForm('/api/clone', ...)`
- [x] Replace with the 3-step flow above
- [x] Keep all existing validation, loading states, and error handling
- [x] The audio file (`Blob`) should already be available from the recording/upload UI

**Test**: Full clone flow in the SPA — record or upload audio → fill in name/transcript → submit → voice appears in Voices list → preview plays.

### 5. Implement `DELETE /voices/:id`

- [x] Add to `routes/voices.ts`

**Goal**: Delete a voice and its reference audio from Storage.

**Implementation**:
- [x] `requireUser()` → extract `user_id`
- [x] SELECT voice via user-scoped client (RLS enforces ownership)
- [x] If not found, return 404
- [x] Delete Storage objects via admin client:
  ```typescript
  await adminClient.storage
    .from('references')
    .remove([voice.reference_object_key])
  ```
- [x] DELETE the voice row via admin client (or user-scoped client, since we have a `voices_delete_own` RLS policy)
- [x] Return 200 `{ ok: true }`

**Test**: Delete a voice → it disappears from the Voices list → reference audio is gone from Storage (verify in Studio → Storage).

### 6. Implement `DELETE /generations/:id`

- [x] Add to `routes/generations.ts`

**Goal**: Delete a generation and its audio from Storage.

**Implementation**:
- [x] `requireUser()`
- [x] SELECT generation via user-scoped client (RLS)
- [x] If not found, return 404
- [x] Delete Storage object if `audio_object_key` is set:
  ```typescript
  if (generation.audio_object_key) {
    await adminClient.storage
      .from('generations')
      .remove([generation.audio_object_key])
  }
  ```
- [x] DELETE the generation row
- [x] Return 200 `{ ok: true }`

**Test**: Delete a generation from History → it disappears → audio file is gone from Storage.

### 7. Implement `DELETE /tasks/:id`

- [x] Add to `routes/tasks.ts`

**Goal**: Delete a task row. Used by `TaskProvider` to clear completed/failed task UI.

**Implementation**:
- [x] `requireUser()`
- [x] SELECT task via user-scoped client (RLS)
- [x] If not found, return 404
- [x] DELETE via admin client (because `authenticated` doesn't have DELETE on tasks — we revoked it in Phase 02)
- [x] Return 200 `{ ok: true }`

**Note**: The frontend currently calls this without auth headers (`TaskProvider.tsx:136`). That bug is fixed in Phase 07. For now, the Edge Function requires auth — the unauthenticated call from TaskProvider will 401. This is expected and not a blocker (task UI will still function, just won't auto-clean).

---

## Files created

| File | Purpose |
|------|---------|
| `supabase/functions/api/routes/clone.ts` | `POST /clone/upload-url`, `POST /clone/finalize` |

## Files modified

| File | Change |
|------|--------|
| `supabase/functions/api/index.ts` | Mount clone routes |
| `supabase/functions/api/routes/voices.ts` | Add `DELETE /voices/:id` |
| `supabase/functions/api/routes/generations.ts` | Add `DELETE /generations/:id` |
| `supabase/functions/api/routes/tasks.ts` | Add `DELETE /tasks/:id` |
| `frontend/src/pages/Clone.tsx` | Rewrite submit handler: 3-step signed-URL upload flow |

---

## Acceptance criteria

- [x] `POST /api/clone/upload-url` returns `{ voice_id, upload_url, object_key }` with valid signed URL
- [x] Uploading a `.wav` file to the signed URL succeeds (200/201)
- [x] `POST /api/clone/finalize` creates the voice row and returns `{ id, name }`
- [x] Full Clone.tsx flow works: record/upload → submit → voice appears in Voices list
- [x] Cloned voice preview plays via `GET /voices/:id/preview`
- [x] `DELETE /voices/:id` removes the DB row AND the Storage object
- [x] `DELETE /generations/:id` removes the DB row AND the Storage object
- [x] `DELETE /tasks/:id` removes the DB row
- [x] All deletes return 404 for non-existent or other-user's resources (RLS)

---

## Gotchas

- **Signed URL TTL**: Keep it short (5 minutes). If the user takes too long between upload-url and actually uploading, the URL expires. The frontend should handle this gracefully (retry upload-url).
- **Content-Type on upload**: The browser must set an appropriate `Content-Type` (e.g. `audio/wav`) when uploading to the signed URL. Some Storage configurations reject uploads without a content type.
- **Clone.tsx is the biggest frontend change**: This is the only page that needs structural modification. All other pages just need minor tweaks (Phase 07).
- **TaskProvider 401**: After this phase, `DELETE /tasks/:id` from TaskProvider will fail because it doesn't include auth headers. This is a known issue, fixed in Phase 07. It doesn't break the app — tasks just aren't auto-cleaned.
