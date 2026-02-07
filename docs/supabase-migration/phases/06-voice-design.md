# Phase 06 — Voice Design

> **Status**: Not Started
> **Prerequisites**: [Phase 05](./05-generate-tasks.md) complete
> **Goal**: Implement voice design preview (Modal-generated) and save designed voices. After this phase, the Design page is fully functional.

---

## Why this phase exists

Voice design is the last feature-complete endpoint group. It uses the same task polling infrastructure from Phase 05 but with a different Modal endpoint (voice design vs. TTS generation).

---

## Steps

### 1. Create `routes/design.ts`

- [ ] Create the file and mount in `index.ts`

### 2. Implement `POST /voices/design/preview`

**Goal**: Submit a voice design preview request to Modal, return a task ID for polling.

**Request body**:
```typescript
{
  text: string,         // Preview text to speak
  language: string,
  instruct: string      // Voice description ("warm female narrator", etc.)
}
```

**Response** (matches `DesignPreviewResponse`):
```typescript
{ task_id: string, status: 'pending' }
```

**Implementation steps**:
- [ ] `requireUser()` → extract `user_id`
- [ ] Validate `text`, `language`, `instruct` (all non-empty)
- [ ] INSERT `tasks` row via admin client:
  ```typescript
  const { data: task } = await adminClient
    .from('tasks')
    .insert({
      user_id,
      type: 'design_preview',
      status: 'pending',
      metadata: { text, language, instruct },
    })
    .select('id')
    .single()
  ```
- [ ] Call Modal voice design endpoint:
  ```typescript
  // Check backend/services/tts_qwen.py for exact endpoint and payload
  const res = await fetch(Deno.env.get('MODAL_ENDPOINT_VOICE_DESIGN')!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language, instruct }),
  })
  ```
- [ ] Handle Modal response:
  - **If synchronous** (returns audio directly): upload to Storage, update task to completed
  - **If job-based** (returns job_id): update task with `modal_job_id`, let `GET /tasks/:id` handle polling + finalization

**For synchronous Modal response**:
- [ ] Upload audio to Storage temp path: `references/${user_id}/preview_${task.id}.wav`
- [ ] Create signed URL for the uploaded audio
- [ ] UPDATE task:
  ```typescript
  await adminClient.from('tasks').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
    result: { audio_url: signedUrl },
  }).eq('id', task.id)
  ```

**For job-based Modal response**:
- [ ] UPDATE task with `modal_job_id` and `status = 'processing'`
- [ ] The existing `GET /tasks/:id` poll handler (Phase 05) handles status checks
- [ ] Add design-preview-specific finalization in the task poll handler:
  when task type is `design_preview` and Modal completes, upload audio to temp Storage path and set `result.audio_url` to a signed URL

- [ ] Return `{ task_id: task.id, status: task.status }`

**Test**: Design page → describe a voice → click preview → poll indicator shows → audio plays when ready.

### 3. Implement `POST /voices/design`

**Goal**: Save the previewed voice as a permanent voice. The frontend sends the preview audio blob back.

**Request**: Multipart FormData containing:
- `name` (string)
- `text` (string — the preview text, becomes `reference_transcript`)
- `language` (string)
- `instruct` (string — becomes `description`)
- `audio` (Blob — the preview audio file)

**Response**:
```typescript
{
  id: string,
  name: string,
  description: string,
  language: string,
  source: 'designed',
  preview_url: string    // Signed URL for the saved reference
}
```

**Implementation steps**:
- [ ] `requireUser()` → extract `user_id`
- [ ] Parse multipart form data:
  ```typescript
  const formData = await c.req.formData()
  const name = formData.get('name') as string
  const text = formData.get('text') as string
  const language = formData.get('language') as string
  const instruct = formData.get('instruct') as string
  const audioFile = formData.get('audio') as File
  ```
- [ ] Validate all fields (non-empty) and audio file (exists, reasonable size)
- [ ] Generate `voice_id = crypto.randomUUID()`
- [ ] Upload audio to Storage:
  ```typescript
  const objectKey = `${user_id}/${voice_id}/reference.wav`
  await adminClient.storage
    .from('references')
    .upload(objectKey, audioFile, { contentType: 'audio/wav', upsert: false })
  ```
- [ ] INSERT `voices` row:
  ```typescript
  await adminClient.from('voices').insert({
    id: voice_id,
    user_id,
    name,
    language,
    source: 'designed',
    description: instruct,
    reference_object_key: objectKey,
    reference_transcript: text,
  })
  ```
- [ ] Create signed preview URL for response
- [ ] Return the response

**Test**: Design page → preview → save → designed voice appears in Voices list → can generate speech with it.

### 4. Handle design preview in task poll handler

If voice design uses job-based Modal (not synchronous), update the `GET /tasks/:id` handler in `routes/tasks.ts`:

- [ ] When task type is `design_preview` and Modal status is completed:
  - Download audio from Modal `getJobResult`
  - Upload to Storage: `references/${user_id}/preview_${task_id}.wav`
  - Create signed URL
  - Update task result: `{ audio_url: signedUrl }`
  - Mark task completed

This is similar to the generate finalization but stores in `references` bucket under a temp path instead of `generations` bucket.

---

## Files created

| File | Purpose |
|------|---------|
| `supabase/functions/api/routes/design.ts` | `POST /voices/design/preview`, `POST /voices/design` |

## Files modified

| File | Change |
|------|--------|
| `supabase/functions/api/index.ts` | Mount design routes |
| `supabase/functions/api/routes/tasks.ts` | (If job-based) Add design_preview finalization branch |

---

## Acceptance criteria

- [ ] `POST /api/voices/design/preview` creates a task and returns `{ task_id, status }`
- [ ] Design preview audio plays in the SPA after task completes
- [ ] Preview audio is stored in Storage (not as base64 in the DB)
- [ ] `POST /api/voices/design` saves the voice with `source = 'designed'`
- [ ] Saved voice appears in Voices list with correct metadata
- [ ] Saved voice can generate speech via `POST /api/generate`
- [ ] Saved voice preview plays via `GET /api/voices/:id/preview`

---

## Gotchas

- **Synchronous vs job-based Modal**: Check how `backend/services/tts_qwen.py` calls the voice design endpoint. If it returns audio directly (not a job ID), the implementation is simpler — no polling needed.
- **Preview audio is small**: Typically < 1MB for a 5-second preview. Passing through Edge Functions as multipart is fine for `POST /voices/design`.
- **Temp preview cleanup**: Preview audio at `references/${user_id}/preview_${task_id}.wav` is orphaned after the voice is saved (which copies audio to the permanent path). Consider a cleanup job later, or accept the small Storage waste for MVP.
- **`apiForm` in frontend**: `POST /voices/design` is the one endpoint that still uses `apiForm` (multipart). The frontend's `apiForm` helper must include auth headers — verify this is the case (it already does via `getDefaultAuthHeaders()`).
