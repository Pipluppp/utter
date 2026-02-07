# Phase 05 — Generate + Task Orchestration

> **Status**: Not Started
> **Prerequisites**: [Phase 04](./04-write-endpoints.md) complete
> **Goal**: Implement Modal integration with poll-driven finalization. This is the most complex phase — it replaces FastAPI's background-thread polling with an on-demand pattern where each frontend poll triggers one Modal status check.

---

## Why this phase exists

This is the core TTS pipeline. Without it, the app can't generate speech. The architecture change is significant: FastAPI polled Modal every 5-10s in a background thread. Edge Functions can't do that (stateless, 400s wall clock). Instead, each `GET /tasks/:id` from the frontend does one Modal status check and potentially finalizes.

---

## Steps

### 1. Create the Modal HTTP client

- [ ] Create `supabase/functions/_shared/modal.ts`

**Goal**: Wrap Modal's HTTP endpoints in typed functions.

```typescript
const MODAL_JOB_SUBMIT = Deno.env.get('MODAL_JOB_SUBMIT')!
const MODAL_JOB_STATUS = Deno.env.get('MODAL_JOB_STATUS')!
const MODAL_JOB_RESULT = Deno.env.get('MODAL_JOB_RESULT')!
const MODAL_JOB_CANCEL = Deno.env.get('MODAL_JOB_CANCEL')

export async function submitJob(payload: {
  text: string
  language: string
  reference_audio_base64: string
  reference_text: string
}): Promise<{ job_id: string }> {
  const res = await fetch(MODAL_JOB_SUBMIT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Modal submit failed: ${res.status}`)
  return res.json()
}

export async function checkJobStatus(jobId: string): Promise<{
  status: string        // 'queued' | 'processing' | 'completed' | 'failed'
  result_ready: boolean
  elapsed_seconds?: number
}> {
  const res = await fetch(`${MODAL_JOB_STATUS}?job_id=${jobId}`)
  if (!res.ok) throw new Error(`Modal status failed: ${res.status}`)
  return res.json()
}

export async function getJobResult(jobId: string): Promise<ArrayBuffer> {
  const res = await fetch(`${MODAL_JOB_RESULT}?job_id=${jobId}`)
  if (!res.ok) throw new Error(`Modal result failed: ${res.status}`)
  return res.arrayBuffer()
}

export async function cancelJob(jobId: string): Promise<void> {
  if (!MODAL_JOB_CANCEL) return  // Cancel endpoint is optional
  await fetch(`${MODAL_JOB_CANCEL}?job_id=${jobId}`, { method: 'POST' })
    .catch(() => {})  // Best-effort, don't throw
}
```

**What to verify**: Check `backend/services/tts_qwen.py` for the exact payload shapes and endpoint signatures. The URLs/payloads above are approximations — match them to the actual Modal API.

### 2. Create `routes/generate.ts`

- [ ] Create the file and mount in `index.ts`

### 3. Implement `POST /generate`

**Goal**: Validate input, create DB rows, submit Modal job, return task info.

**Request body**:
```typescript
{ voice_id: string, text: string, language: string }
```

**Response** (matches `GenerateResponse`):
```typescript
{
  task_id: string,
  generation_id: string,
  status: 'processing',
  is_long_running: true,
  estimated_duration_minutes: 1
}
```

**Implementation steps**:
- [ ] `requireUser()` → extract `user_id`
- [ ] Validate `voice_id` (uuid), `text` (non-empty), `language`
- [ ] Verify voice belongs to user via user-scoped SELECT (RLS)
- [ ] Check voice has `reference_object_key` and `reference_transcript` (Qwen requirement)
- [ ] Download reference audio from Storage:
  ```typescript
  const { data: audioBytes } = await adminClient.storage
    .from('references')
    .download(voice.reference_object_key)
  const base64Audio = btoa(String.fromCharCode(...new Uint8Array(await audioBytes.arrayBuffer())))
  ```
- [ ] INSERT `generations` row via admin client:
  ```typescript
  const { data: generation } = await adminClient
    .from('generations')
    .insert({
      user_id,
      voice_id: voice.id,
      text,
      language,
      status: 'processing',
    })
    .select('id')
    .single()
  ```
- [ ] INSERT `tasks` row via admin client:
  ```typescript
  const { data: task } = await adminClient
    .from('tasks')
    .insert({
      user_id,
      type: 'generate',
      status: 'pending',
      generation_id: generation.id,
      voice_id: voice.id,
      metadata: { text_length: text.length, language },
    })
    .select('id')
    .single()
  ```
- [ ] Call Modal `submitJob`:
  ```typescript
  const { job_id } = await submitJob({
    text,
    language,
    reference_audio_base64: base64Audio,
    reference_text: voice.reference_transcript,
  })
  ```
- [ ] UPDATE task with `modal_job_id` and `status = 'processing'`:
  ```typescript
  await adminClient
    .from('tasks')
    .update({ modal_job_id: job_id, status: 'processing' })
    .eq('id', task.id)
  ```
- [ ] Return `GenerateResponse`

**Test**: Click "Generate" in the SPA → Network tab shows POST → returns task_id → TaskProvider starts polling.

### 4. Upgrade `GET /tasks/:id` with Modal polling + finalization

- [ ] Edit `routes/tasks.ts` — replace the simple read from Phase 03

**Goal**: On each poll, check Modal status and finalize if complete.

**Flow**:
```
1. requireUser() + SELECT task (user-scoped, RLS)
2. If task not found → 404
3. If terminal (completed|failed|cancelled) → return as-is
   - If completed with generation: include audio URL in result
4. If processing with modal_job_id:
   a. UPDATE modal_poll_count atomically
   b. Call Modal checkJobStatus(modal_job_id)
   c. RUNNING → return { status: 'processing', modal_status, modal_elapsed_seconds }
   d. FAILED → update task+generation to failed, return
   e. COMPLETED → finalize (see below)
```

**Finalization (step 4e)**:
```
1. SELECT generation — check audio_object_key IS NOT NULL
   → If set, finalization already done (concurrent poll). Skip to return.
2. Fetch audio bytes: getJobResult(modal_job_id)
3. Upload to Storage:
   await adminClient.storage.from('generations').upload(
     `${user_id}/${generation_id}.wav`,
     audioBytes,
     { contentType: 'audio/wav', upsert: true }
   )
4. UPDATE generations:
   SET audio_object_key = '...', status = 'completed',
       generation_time_seconds = EXTRACT(EPOCH FROM (now() - created_at)),
       completed_at = now()
   WHERE id = generation_id AND audio_object_key IS NULL
   (atomic guard — if 0 rows updated, another poll already finalized)
5. UPDATE tasks:
   SET status = 'completed', completed_at = now(),
       result = { audio_url: '/api/generations/<id>/audio' }
   WHERE id = task_id
6. Return completed task
```

**Returning completed tasks**: When a task is completed (or already was), include a signed audio URL:
```typescript
if (task.status === 'completed' && task.generation_id) {
  const gen = await adminClient.from('generations').select('audio_object_key').eq('id', task.generation_id).single()
  if (gen.data?.audio_object_key) {
    // Update result with fresh signed URL for immediate playback
    task.result = {
      ...task.result,
      audio_url: `/api/generations/${task.generation_id}/audio`,
    }
  }
}
```

**Test**:
- [ ] Generate speech → watch task polling in Network tab (every 1000ms from TaskProvider)
- [ ] Audio plays when generation completes
- [ ] Refresh page during generation → polling resumes from DB state
- [ ] Open two tabs → both poll → only one finalization upload happens

### 5. Implement `POST /tasks/:id/cancel`

- [ ] Add to `routes/tasks.ts`

**Goal**: Cancel an in-progress task. Best-effort Modal cancellation.

**Implementation**:
- [ ] `requireUser()` + SELECT task (user-scoped)
- [ ] If already terminal → return current status (no error)
- [ ] If `modal_job_id` and `MODAL_JOB_CANCEL` is configured → call `cancelJob(modal_job_id)`
- [ ] UPDATE task → `status = 'cancelled'`, `completed_at = now()`
- [ ] UPDATE generation → `status = 'cancelled'` (if task has `generation_id`)
- [ ] Return `{ cancelled: true, task_id: task.id }`

**Test**: Start a generation → click cancel in the SPA → task shows as cancelled.

### 6. Implement `POST /generations/:id/regenerate`

- [ ] Add to `routes/generations.ts`

**Goal**: Return the voice/text/language from an existing generation so the frontend can pre-fill the Generate form.

**Response** (matches `RegenerateResponse`):
```typescript
{ voice_id: string, text: string, language: string, redirect_url: '/generate' }
```

**Implementation**:
- [ ] `requireUser()` + SELECT generation (user-scoped)
- [ ] Return `{ voice_id, text, language, redirect_url: '/generate' }`

**Test**: Click "Regenerate" on a generation in History → redirects to Generate page with fields pre-filled.

---

## Files created

| File | Purpose |
|------|---------|
| `supabase/functions/_shared/modal.ts` | Modal HTTP client (submit, status, result, cancel) |
| `supabase/functions/api/routes/generate.ts` | `POST /generate` |

## Files modified

| File | Change |
|------|--------|
| `supabase/functions/api/index.ts` | Mount generate routes |
| `supabase/functions/api/routes/tasks.ts` | Full rewrite: add Modal polling + finalization logic |
| `supabase/functions/api/routes/generations.ts` | Add `POST /generations/:id/regenerate` |

---

## Acceptance criteria

- [ ] `POST /api/generate` creates generation + task rows and returns `GenerateResponse`
- [ ] `GET /api/tasks/:id` triggers Modal status check and increments `modal_poll_count`
- [ ] Completed Modal job triggers finalization: audio uploaded to Storage, generation updated, task completed
- [ ] Finalization is idempotent: two concurrent polls don't cause double uploads or errors
- [ ] `POST /api/tasks/:id/cancel` cancels the task and (best-effort) the Modal job
- [ ] `POST /api/generations/:id/regenerate` returns correct `RegenerateResponse`
- [ ] Full SPA flow: Generate → poll → audio plays → appears in History
- [ ] Page refresh during generation: polling resumes, generation completes normally

---

## Gotchas

- **Base64 encoding large audio**: Reference audio can be up to 50MB. `btoa()` may have memory issues. Consider streaming or chunked encoding if you hit limits. For MVP (typical references are 5-30s / 1-5MB), `btoa` should be fine.
- **Modal endpoint URLs**: Triple-check these match your actual Modal deployment. A typo will cause silent failures.
- **`upsert: true` on Storage upload**: Handles the rare case where two concurrent finalizers both upload. The second upload overwrites with identical bytes — no corruption.
- **200ms CPU limit**: The finalization (download from Modal + upload to Storage + DB updates) uses wall clock time, not CPU time. The 200ms CPU limit is for computation. Network I/O doesn't count against CPU. The 400s wall clock limit is the real constraint.
- **TaskProvider polls at 1000ms**: Each poll = one Edge Function invocation = one Modal status check. This is by design. The Edge Function should complete in < 1s for non-finalizing polls.
