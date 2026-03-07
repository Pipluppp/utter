# Cloudflare Queues Migration Plan (Standalone)

Date: 2026-03-02  
Status: Planning -> implementation-ready

## 0) Verified Cloudflare Queues facts (implementation-critical)

Verified against current Cloudflare docs:

1. Free plan includes `10,000` queue operations/day (read/write/delete).
2. Free-plan message retention is fixed at `24 hours`.
3. Delivery is at-least-once; duplicates are possible and must be handled idempotently.
4. Default delivery retries are 3 (`max_retries` configurable, limit 100).
5. Queue consumer wall-time limit is 15 minutes; default CPU is 30s, configurable up to 5 minutes.
6. Per-message size limit is 128 KB.
7. `delaySeconds` can be used for delayed retries/rechecks (up to 12 hours).
8. One active consumer per queue.

References:

- https://developers.cloudflare.com/queues/platform/pricing/
- https://developers.cloudflare.com/queues/platform/limits/
- https://developers.cloudflare.com/queues/reference/how-queues-works/
- https://developers.cloudflare.com/queues/configuration/batching-retries/
- https://developers.cloudflare.com/queues/configuration/javascript-apis/
- https://developers.cloudflare.com/queues/configuration/dead-letter-queues/

## 1) Why this migration exists

Current async orchestration is split across:

1. Frontend polling every 1s (`GET /api/tasks/:id`)
2. Backend `GET /tasks/:id` doing writes + provider calls
3. `EdgeRuntime.waitUntil(...)` background paths without durable retry

This creates complexity and reliability risk:

1. `GET` handlers with side effects
2. Provider calls repeated under user polling pressure
3. Silent failures in background paths
4. Refund/finalization recovery depending on in-flight runtime behavior

## 1.1) Prerequisite order

Queues migration depends on Cloudflare Worker API runtime being in place first.

Required ordering:

1. API moved from Supabase Edge Functions to Cloudflare Workers
2. Then queue producer + consumer integration

## 2) Target model

Use Cloudflare Queues as the async executor while preserving existing DB/auth/security model.

### What remains unchanged

1. Frontend task polling UX (initially)
2. Task state machine (`pending -> processing -> terminal`)
3. Credits and billing correctness logic in Postgres RPC/idempotency keys
4. Cancellation flag semantics (`cancellation_requested`)

### What changes

1. `POST` task-creation endpoints enqueue work.
2. Queue consumer performs provider orchestration + persistence.
3. `GET /api/tasks/:id` becomes read-only status retrieval.

## 2.1) Current feature map to migrate

This section verifies exactly which existing features should move to Queues and why.

| Feature | Current implementation | Queue replacement | Size | Relevance |
|---|---|---|---|---|
| Generate (Qwen) | `EdgeRuntime.waitUntil(processQwenGenerationTask)` in `generate.ts` | `POST /generate` enqueues `generate.qwen.start`; consumer executes full pipeline | High | Very high |
| Design preview (Qwen) | `EdgeRuntime.waitUntil(runQwenDesignPreviewTask)` in `design.ts` | `POST /voices/design/preview` enqueues `design_preview.qwen.start`; consumer executes pipeline | High | High |
| Modal task finalization | `GET /tasks/:id` calls provider, downloads result, uploads audio, updates DB | enqueue `generate.modal.check` rechecks; consumer finalizes task | High | High |
| Modal design "first poll claim" | `GET /tasks/:id` starts work on first poll | enqueue design work from `POST /voices/design/preview` immediately | Medium | High |
| Stripe webhook heavy processing | webhook route does full processing inline | keep signature verify inline, enqueue processing message | Medium | Medium |

Features to keep synchronous (do not queue now):

1. `/clone/finalize` main path (already request/response coupled and simpler)
2. `/transcriptions` (user waits for immediate transcript output)
3. Credits and trial RPC internals (must remain transactional DB operations)
4. Rate-limit check RPC (not a queue workload)

## 3) Queue scope and sequence

## Q1 (first cut, highest value)

1. Qwen generate pipeline
2. Qwen design preview pipeline

## Q2

1. Modal generate finalization
2. Modal design preview execution (remove "first poll claims work")

## Q3 (optional)

1. Stripe webhook heavy processing after signature verification
2. Storage cleanup retries

## 4) Queue topology

Minimal topology:

1. `tts-jobs` queue
   - handles generate/design provider work
2. `tts-jobs-dlq` dead-letter queue
3. Optional `billing-events` queue + DLQ (later phase)

### Recommended initial configuration values

For `tts-jobs` consumer:

1. `max_batch_size`: 1 to 5 for provider-heavy calls
2. `max_batch_timeout`: 1-5 seconds
3. `max_retries`: 3 (start default)
4. `max_concurrency`: start conservative (for provider protection), raise with load data
5. `dead_letter_queue`: `tts-jobs-dlq`

### Wrangler example (reference)

```toml
name = "utter-api"
main = "src/index.ts"
compatibility_date = "2026-03-02"

[[queues.producers]]
queue = "tts-jobs"
binding = "TTS_QUEUE"

[[queues.producers]]
queue = "billing-events"
binding = "BILLING_QUEUE"

[[queues.consumers]]
queue = "tts-jobs"
max_batch_size = 1
max_batch_timeout = 2
max_retries = 3
dead_letter_queue = "tts-jobs-dlq"
# max_concurrency = 5
```

## 5) Message contracts

Use strict versioned envelopes:

```json
{
  "version": 1,
  "type": "generate.qwen.start",
  "task_id": "uuid",
  "user_id": "uuid",
  "generation_id": "uuid",
  "provider": "qwen",
  "payload": {
    "text": "string",
    "language": "string",
    "provider_voice_id": "string",
    "provider_target_model": "string"
  },
  "idempotency": {
    "task_key": "task:uuid",
    "credit_refund_key": "generate:<generation_id>:refund"
  },
  "enqueued_at": "iso"
}
```

```json
{
  "version": 1,
  "type": "design_preview.qwen.start",
  "task_id": "uuid",
  "user_id": "uuid",
  "provider": "qwen",
  "payload": {
    "text": "string",
    "language": "string",
    "instruct": "string",
    "name": "string"
  },
  "idempotency": {
    "task_key": "task:uuid"
  },
  "enqueued_at": "iso"
}
```

```json
{
  "version": 1,
  "type": "generate.modal.check",
  "task_id": "uuid",
  "user_id": "uuid",
  "generation_id": "uuid",
  "provider": "modal",
  "payload": {
    "provider_job_id": "string"
  },
  "attempt": 1,
  "enqueued_at": "iso"
}
```

### Message design rules

1. Include `version` for forward compatibility.
2. Include `task_id` and `user_id` in every message.
3. Include only minimal payload required to continue work.
4. Never include secrets in message bodies.
5. Keep message body well below 128KB.

## 6) Producer-side changes

## Endpoints to update

1. `POST /api/generate`
2. `POST /api/voices/design/preview`

### Producer responsibilities

1. Validate request + auth.
2. Apply debit/trial logic as today.
3. Create task and related rows.
4. Enqueue queue message.
5. Return task response immediately.

### Producer non-responsibilities after migration

1. No provider submission/finalization work in request thread.
2. No `waitUntil` orchestration.

### Concrete producer mapping (current files)

1. `supabase/functions/api/routes/generate.ts`
   - replace `EdgeRuntime.waitUntil(...)` branch with enqueue call
2. `supabase/functions/api/routes/design.ts`
   - replace `EdgeRuntime.waitUntil(...)` branch with enqueue call
3. `supabase/functions/api/routes/tasks.ts`
   - remove "claim-on-first-poll to start design work" pattern after queue migration

## 7) Consumer responsibilities

### Core steps (all job types)

1. Load task row by `task_id`.
2. Exit early if task already terminal.
3. Check `cancellation_requested` before each expensive step.
4. Perform provider action(s).
5. Persist outputs (storage + DB state).
6. On failure:
   - mark task/generation failed where appropriate
   - perform idempotent refund/trial restore path as needed
7. `ack` on success; retry on transient failure; route to DLQ after retry limit.

### Modal-specific pattern

Use delayed re-enqueue for status rechecks instead of provider polling in `GET /tasks/:id`.

### Qwen-specific pattern

Direct synchronous provider call and persistence in consumer; no runtime `waitUntil`.

### `ack` / `retry` policy

1. `ack()` only after DB status and storage writes succeed.
2. `retry({ delaySeconds })` for transient provider/network/storage errors.
3. Use exponential backoff by `msg.attempts`.
4. For validation/non-retryable errors:
   - mark task failed
   - run idempotent refund/restore path
   - `ack()` to prevent useless retries.

## 8) Task endpoint simplification

`GET /api/tasks/:id` should become:

1. auth + ownership check
2. read current task row (+ optional derived display fields)
3. return status/result/error

No:

1. provider network calls
2. storage uploads
3. task claim/start side effects

Current side-effect code to remove from read path:

1. Provider status checks in `GET /tasks/:id`
2. Modal result download/upload from `GET /tasks/:id`
3. Poll-count increment RPC from `GET /tasks/:id`

## 9) Cancellation and idempotency rules

1. Keep `POST /tasks/:id/cancel` as DB state transition endpoint.
2. Consumer checks cancellation between provider steps.
3. Refunds remain idempotent via existing keys.
4. Never debit in consumer for these flows (debit remains on request path).

## 10) Free-plan operations budgeting

Free-plan queue operations are finite per day.  
Plan with an explicit budget model:

1. `ops = writes + reads + deletes + retry_reads`
2. Track:
   - jobs/day
   - average retries/job
   - delayed recheck fanout/job

Adoption rule:

1. ship Q1 with metering dashboards first
2. only add Q2/Q3 workloads if daily headroom remains healthy

### Practical budgeting guidance

1. Base success path message cost is typically ~3 operations.
2. Each retry adds a read operation.
3. DLQ write adds write operations.
4. Delayed recheck pattern (Modal) can multiply operations per user task.

Track in staging:

1. average queue ops per successful generate
2. average retries per job type
3. DLQ rate by message type

## 11) File-level migration map

Primary files impacted:

1. `supabase/functions/api/routes/generate.ts`
2. `supabase/functions/api/routes/design.ts`
3. `supabase/functions/api/routes/tasks.ts`
4. `supabase/functions/api/routes/billing.ts` (optional phase)
5. New Worker queue consumer files in Cloudflare worker package

Secondary:

1. Worker config/bindings
2. Observability logging helpers
3. Queue message schema module

### Additional worker files to add

1. `workers/api/src/queues/messages.ts` (schema + type guards)
2. `workers/api/src/queues/producer.ts` (enqueue helpers)
3. `workers/api/src/queues/consumer.ts` (queue handler router)
4. `workers/api/src/queues/handlers/*` (generate/design/modal/billing handlers)

## 12) Rollout plan

## Step 0: feature flags

1. `QUEUE_GENERATE_ENABLED`
2. `QUEUE_DESIGN_PREVIEW_ENABLED`
3. `QUEUE_MODAL_RECHECK_ENABLED`
4. `QUEUE_BILLING_ENABLED`

## Step 1: Qwen-only queue cutover

1. Enable queue for qwen generate/design preview.
2. Keep existing modal path as fallback.

## Step 2: Modal queue cutover

1. Enable modal status/finalization via queue.
2. Remove provider polling side effects from `GET /tasks/:id`.

## Step 3: cleanup

1. Remove obsolete `waitUntil` codepaths.
2. Remove modal poll counters if unused.

## 13) Acceptance criteria

1. No provider calls in `GET /api/tasks/:id`.
2. Task completion still visible through existing frontend polling.
3. Retry behavior handles transient provider/storage failures.
4. No duplicate debit/refund effects under redelivery.
5. Cancellation remains effective during in-flight processing.
6. DLQ captures unrecoverable jobs with actionable context.

## 13.1) Test matrix (must pass before cutover)

1. Duplicate message redelivery does not double-refund.
2. Cancelled task never reaches completed from stale consumer run.
3. Qwen/Modal transient failure retries and eventually succeeds.
4. Permanent failure lands in DLQ and task remains failed.
5. `GET /tasks/:id` no longer calls providers or writes poll counters.
6. Credits/billing balances reconcile with ledger after retry scenarios.

## 14) Risks and mitigations

1. Free-plan operation exhaustion  
Mitigation: phased adoption + operation metering + conservative recheck cadence.

2. Duplicate message delivery side effects  
Mitigation: terminal-state guards + idempotency keys + conditional updates.

3. Hard-to-debug async failures  
Mitigation: structured logs with `task_id`, `type`, `attempt`, `provider`, `error_class`.

## 15) References

1. `explainer.md` architecture walkthrough
2. [cloudflare-queues-evaluation.md](./cloudflare-queues-evaluation.md)
3. Cloudflare Queues docs:
   - https://developers.cloudflare.com/queues/
   - https://developers.cloudflare.com/queues/platform/pricing/
   - https://developers.cloudflare.com/queues/platform/limits/
   - https://developers.cloudflare.com/queues/configuration/batching-retries/
   - https://developers.cloudflare.com/queues/configuration/dead-letter-queues/
