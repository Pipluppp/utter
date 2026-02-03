# Job-Based Task Architecture for Qwen3-TTS Voice Generation

> **Date**: 2026-02-02
> **Status**: Implemented and Deployed
> **Related**: [Deployment Architecture Plan](../../docs/2026-02-02/deployment-architecture-plan.md)

## Goal

Enable reliable speech generation using Qwen3-TTS on Modal.com with:
- **Cancellation support** for all generations
- **Consistent behavior** across all text lengths
- **Resilience** to backend restarts

Based on benchmarks, Qwen3-TTS processes at approximately **1.6x real-time** (using **2x** for conservative estimates):
- 1-minute audio = ~2 minutes execution time
- 5-minute audio = ~10 minutes execution time
- 10-minute audio = ~20 minutes execution time

---

## Why Job-Based for Everything?

**All generations now use the job-based (spawn/poll) pattern**, regardless of text length.

### Benefits over Direct HTTP
| Benefit | Description |
|---------|-------------|
| **Cancellation** | Users can abort any generation via Modal's `FunctionCall.cancel()` |
| **Resilience** | Job continues even if backend restarts - job ID persists |
| **No timeout edge cases** | No 10-minute timeout bug from a direct/synchronous HTTP path |
| **Consistent UX** | Same behavior for 10-second and 10-minute generations |

### Trade-off
~500ms overhead per request (submit + result fetch). Negligible for any generation over 10 seconds.

---

## The Problem: Modal's 150-Second HTTP Timeout

Modal web endpoints have a hard limit: **HTTP requests timeout after 150 seconds**.

From [Modal's Request Timeouts documentation](https://modal.com/docs/guide/webhook-timeouts):

> In case the function takes more than 150 seconds to complete, a HTTP status 303 redirect
> response is returned pointing at the original URL with a special query parameter.

While Modal supports automatic redirect handling (browsers allow ~20 redirects = ~50 minutes), this approach has limitations:
- CORS issues with redirected requests
- Client library redirect limits (Python's urllib defaults to 4 redirects = 12.5 min max)
- No way to show progress or allow cancellation

**Solution**: Use Modal's **spawn/poll pattern** (job queue) instead of synchronous HTTP.

---

## Why This Matters for Supabase-Only Architecture

> See [Deployment Architecture Plan](../../docs/2026-02-02/deployment-architecture-plan.md) for full context.

The planned production architecture uses **Supabase Edge Functions** as the backend, which have a **400-second wall-clock limit**. Without the spawn/poll pattern:

| Scenario | Generation Time | Supabase Limit | Status |
|----------|----------------|----------------|--------|
| Job-based orchestration calls (submit/status/result) | seconds per call | 400s | ✅ Fits comfortably |
| Full synchronous generation inside Edge | **minutes** | 400s | ❌ Exceeds limit |

**The spawn/poll pattern solves this**: Each Edge Function call completes in seconds (just forwarding to Modal), while the actual generation runs asynchronously in Modal's infrastructure.

```
┌─────────────────────────────────────────────────────────────────────┐
│              SUPABASE EDGE FUNCTION (each call < 5s)                │
└─────────────────────────────────────────────────────────────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
   POST /generate      GET /tasks/:id       GET /tasks/:id
   (submit to Modal)   (poll Modal status)  (get Modal result)
        │                    │                    │
        ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         MODAL.COM                                    │
│   /submit-job          /job-status          /job-result             │
│   (instant return)     (instant return)     (returns audio)         │
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │  generate_voice_clone_job (runs 25 min in background)       │   │
│   └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Architecture: Spawn/Poll Pattern

Based on [Modal's Job Processing guide](https://modal.com/docs/guide/job-queue):

```
┌─────────────┐      ┌─────────────────────┐      ┌─────────────────────────┐
│   Client    │      │  Voice Clone App    │      │   GPU Job Function      │
│  (Browser)  │      │  (Modal Endpoints)  │      │   (Long-running)        │
└─────────────┘      └─────────────────────┘      └─────────────────────────┘
       │                       │                            │
       │  POST /submit-job     │                            │
       │──────────────────────>│                            │
       │                       │   spawn()                  │
       │                       │───────────────────────────>│
       │                       │   returns FunctionCall     │
       │   { job_id: "fc-xx" } │<───────────────────────────│
       │<──────────────────────│                            │
       │                       │                            │
       │  GET /job-status      │                            │  (processing...)
       │──────────────────────>│                            │
       │                       │   get(timeout=0)           │
       │   { status: running } │<───────────────────────────│
       │<──────────────────────│                            │
       │                       │                            │
       │        ...polling...  │                            │
       │                       │                            │
       │  GET /job-status      │                            │  (complete!)
       │──────────────────────>│                            │
       │  { status: completed }│   get(timeout=0) → result  │
       │<──────────────────────│<───────────────────────────│
       │                       │                            │
       │  GET /job-result      │                            │
       │──────────────────────>│                            │
       │                       │   get(timeout=5)           │
       │   audio/wav bytes     │<───────────────────────────│
       │<──────────────────────│                            │
```

---

## Key Modal APIs Used

### 1. `Function.spawn()` - Submit Job

From [modal.Function reference](https://modal.com/docs/reference/modal.Function):

> `.spawn()` calls the function with the given arguments, without waiting for the results.
> Returns a `modal.FunctionCall` object that can later be polled or waited for.

```python
# Spawn returns immediately with a FunctionCall object
function_call = generate_voice_clone_job.spawn(
    text=text,
    language=language,
    ref_audio_base64=ref_audio_base64,
    ref_text=ref_text,
)

# Get the job_id to return to client
job_id = function_call.object_id
```

### 2. `FunctionCall.from_id()` - Reconstruct Job Reference

From [modal.FunctionCall reference](https://modal.com/docs/reference/modal.FunctionCall):

> Constructed using `.spawn(...)` on a Modal function. Acts as a reference to an ongoing
> function call that can be passed around and used to poll or fetch function results.

```python
# Reconstruct from saved job_id (across requests/processes)
function_call = modal.FunctionCall.from_id(job_id)
```

### 3. `FunctionCall.get(timeout)` - Check/Retrieve Result

```python
# Non-blocking poll (timeout=0)
try:
    result = function_call.get(timeout=0)
    # Job complete!
except TimeoutError:
    # Still processing

# Blocking wait with timeout
result = function_call.get(timeout=5)  # Wait up to 5 seconds
```

**Important**: Results are accessible for up to **7 days** after completion.

### 4. `FunctionCall.cancel()` - Cancel Running Job

```python
function_call = modal.FunctionCall.from_id(job_id)
function_call.cancel()  # Terminates execution
```

---

## Current Implementation

### Deployed Modal Apps

As of 2026-02-02, we consolidated endpoints to fit within Modal's free tier limit of 8 web endpoints:

**`qwen3-tts-voice-clone-06b`** (5 endpoints):
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/clone` | POST | Direct voice cloning (short texts) |
| `/health` | GET | Health check |
| `/submit-job` | POST | Submit long-running job |
| `/job-status` | GET | Poll job status |
| `/job-result` | GET | Retrieve completed audio |

**`qwen3-tts-voice-design`** (2 endpoints):
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/design` | POST | Design voice from description |
| `/health` | GET | Health check |

**Total: 7 endpoints** (within 8 limit)

### Function Timeout Configuration

From [Modal's Timeouts guide](https://modal.com/docs/guide/timeouts):

> All Modal Function executions have a default execution timeout of 300 seconds (5 minutes),
> but users may specify timeout durations between 1 second and 24 hours.

```python
MAX_GENERATION_TIMEOUT = 1800  # 30 minutes

@app.function(
    timeout=MAX_GENERATION_TIMEOUT,
    scaledown_window=300,  # Keep container warm for 5 min
)
def generate_voice_clone_job(...):
    ...
```

### Container Warm-up with `scaledown_window`

From [Modal's Cold Start guide](https://modal.com/docs/guide/cold-start):

The `scaledown_window` parameter keeps containers alive after completing a request, avoiding cold starts for subsequent jobs:

```python
@app.function(
    scaledown_window=300,  # 5 minutes
)
```

This is important because model loading takes ~30-60 seconds. With `scaledown_window=300`, if another job arrives within 5 minutes, it reuses the warm container with the model already loaded.

---

## Backend Integration (Current: FastAPI)

### Routing Logic (Job-based for all generations)

All speech generations now use the job-based (spawn/poll) path for consistency and cancellation support.

```python
# backend/main.py - _process_generation()
output_path, job_id = await generate_speech(
    voice_id=voice_id,
    text=text,
    ref_text=ref_text,
    language=language,
    task_id=task_id,
    cancellation_checker=task_store.is_cancellation_requested,
)
task_store.set_modal_job_id(task_id, job_id)
```

### Polling Loop with Cancellation

```python
# tts_qwen.py - poll_job_until_complete()
async def poll_job_until_complete(
    job_id: str,
    poll_interval: float = 5.0,
    max_duration_seconds: float = 1800.0,
    cancellation_checker: Optional[Callable] = None,
) -> str:
    while True:
        # Check timeout
        if elapsed > max_duration_seconds:
            raise ValueError("Job timed out")

        # Check cancellation
        if cancellation_checker and cancellation_checker(task_id):
            await cancel_job(job_id)
            raise ValueError("Cancelled by user")

        # Check status
        status = await check_job_status(job_id)
        if status["status"] == "completed":
            return await get_job_result(job_id)

        await asyncio.sleep(poll_interval)
```

---

## Future: Supabase Edge Function Integration

> See [Deployment Architecture Plan - Section 6](../../docs/2026-02-02/deployment-architecture-plan.md#6-task-queue--long-running-jobs) for details.
>
> Bridge doc: `docs/2026-02-05/job-based-edge-orchestration.md`

When migrating to Supabase Edge Functions, the pattern remains the same:

```typescript
// supabase/functions/generate/index.ts
serve(async (req: Request) => {
  const { voice_id, text, language } = await req.json();

  // Create task in Supabase DB
  const { data: task } = await supabase
    .from("tasks")
    .insert({ user_id, type: "generate", status: "pending" })
    .select().single();

  // Submit to Modal job endpoint (job-based for all generations)
  const { job_id } = await fetch(MODAL_SUBMIT_JOB_URL, {
    method: "POST",
    body: JSON.stringify({ text, language, ref_audio_base64, ref_text }),
  }).then(r => r.json());

  await supabase.from("tasks").update({
    metadata: { modal_job_id: job_id },
    status: "processing"
  }).eq("id", task.id);

  // Return immediately - frontend polls /tasks/:id (or subscribes via Realtime)
  return Response.json({ task_id: task.id });
});
```

**Recommended Edge approach**: implement poll-driven finalization in `GET /tasks/:id`:
- poll Modal status using `job_id`
- when complete, fetch `job-result`, upload to Supabase Storage, and mark task/generation completed

---

## Capacity Verification

| Parameter | Value | Requirement | Status |
|-----------|-------|-------------|--------|
| Function timeout | 30 min | 25 min for 10-min audio | ✅ |
| Task TTL | 1 hour | 25 min + buffer | ✅ |
| Polling max duration | 30 min | 25 min | ✅ |
| Max text length | 50,000 chars | ~15,000 for 10-min audio | ✅ |
| Result retention | 7 days (Modal default) | Hours | ✅ |
| Direct path timeout | n/a | Job-based only | ✅ |

---

## Deployment

Deploy the voice clone app (includes job management):

```bash
cd modal_app/qwen3_tts
uv run modal deploy app_06b.py
uv run modal deploy app_voice_design.py
```

Endpoint URLs (configured in `backend/config.py`):
- `QWEN_MODAL_ENDPOINT_0_6B` - Direct clone endpoint
- `QWEN_MODAL_JOB_SUBMIT` - POST /submit-job
- `QWEN_MODAL_JOB_STATUS` - GET /job-status
- `QWEN_MODAL_JOB_RESULT` - GET /job-result

---

## References

### Modal.com Documentation
- [Request Timeouts](https://modal.com/docs/guide/webhook-timeouts) - 150s limit and redirect behavior
- [Job Processing](https://modal.com/docs/guide/job-queue) - Spawn/poll pattern
- [Timeouts](https://modal.com/docs/guide/timeouts) - Function timeout configuration (1s-24h)
- [FunctionCall](https://modal.com/docs/reference/modal.FunctionCall) - Job API reference
- [Invoking Deployed Functions](https://modal.com/docs/guide/trigger-deployed-functions) - Cross-app calls
- [Cold Start](https://modal.com/docs/guide/cold-start) - Container warm-up

### Project Documentation
- [Deployment Architecture Plan](../../docs/2026-02-02/deployment-architecture-plan.md) - Supabase-only architecture
- [Features Documentation](../../docs/features.md) - Complete feature reference
