# Cloudflare Queues Evaluation for Utter

Date: 2026-03-02  
Based on: `explainer.md`, current API routes, and official Cloudflare Queues docs.

## Executive summary

Cloudflare Queues can simplify Utter meaningfully in targeted areas, but should be used selectively on the free plan.

Best immediate wins:

1. Move Qwen async `waitUntil` flows to queue consumers.
2. Move Modal status polling/finalization off `GET /tasks/:id` into queue-driven job processing.
3. Keep credits/billing correctness logic in Postgres RPCs exactly as-is.

Use with caution on free plan:

- Free plan includes 10,000 operations/day across reads/writes/deletes and 24h retention.
- Queue-heavy polling loops can consume free operations quickly.

## Current async hotspots in codebase

1. Qwen generate background flow:
   - `supabase/functions/api/routes/generate.ts` (`EdgeRuntime.waitUntil`, `processQwenGenerationTask`)
2. Qwen/preview design background flow:
   - `supabase/functions/api/routes/design.ts` (`EdgeRuntime.waitUntil`, `runQwenDesignPreviewTask`)
3. Modal design and generation finalization currently coupled to task polling:
   - `supabase/functions/api/routes/tasks.ts` (`GET /tasks/:id` checks provider status, downloads result, uploads audio, updates DB)
4. Stripe webhook does full processing inline:
   - `supabase/functions/api/routes/billing.ts` (`POST /webhooks/stripe`)

## Queue fit assessment

| Candidate | Fit | Why |
|---|---|---|
| Qwen generate async processing | High | Natural background job, currently runtime-coupled via `waitUntil` |
| Qwen design preview async processing | High | Same pattern as above, clean queue message model |
| Modal status polling/finalization | High | Removes provider polling from user-facing `GET /tasks/:id` path |
| Stripe webhook heavy processing | Medium | Good for durability/latency, but must preserve signature + idempotent DB model |
| Storage cleanup (deletes) | Medium | Can reduce request latency; failure-isolated retries |
| Rate limiting | Low | Not a queue problem; current atomic DB RPC is appropriate |
| Credits ledger mutations | Low | Must stay in transactional Postgres RPC path |

## Recommended queue topology (minimal)

1. `tts-jobs` queue
   - Messages for:
     - qwen-generate-start
     - qwen-design-preview-start
     - modal-check-status
2. `billing-events` queue
   - Optional second phase:
     - validated webhook payload references for asynchronous processing
3. `storage-cleanup` queue
   - Optional:
     - object deletion retries

## Proposed behavior changes

### A) Generate flow (recommended)

Current:

1. `POST /api/generate` creates task.
2. Qwen path runs `waitUntil` in-request.
3. Modal path relies on frontend polling `GET /tasks/:id` which polls provider.

Proposed:

1. `POST /api/generate` creates task, enqueues job, returns immediately.
2. Queue consumer handles provider submission/poll/finalization.
3. `GET /api/tasks/:id` becomes a DB-read endpoint only (no provider calls).

Benefits:

1. Lower p95 latency for task status endpoint.
2. Less coupling to user polling frequency.
3. Better retry and failure isolation via retries + DLQ.

### B) Design preview flow (recommended)

Current:

1. Task may start in `GET /tasks/:id` (Modal path) or `waitUntil` (Qwen path).

Proposed:

1. `POST /voices/design/preview` enqueues worker message immediately after task insert.
2. Consumer executes provider work and stores result.
3. `GET /tasks/:id` reports status only.

Benefits:

1. Removes "first poll triggers work" complexity.
2. Makes behavior consistent across providers.

### C) Billing webhook flow (optional, phase 2)

Current:

1. Signature verification + dedupe + grant all in request.

Proposed:

1. Keep signature verify + received-event write inline.
2. Enqueue processing message.
3. Consumer performs pack resolution + `credit_apply_event` + status update.

Benefits:

1. Faster webhook response.
2. Cleaner retry/DLQ behavior.

Constraint:

1. Must preserve existing idempotency keys and unique constraints.

## Free-plan impact model

Queues operations are charged per message write/read/delete (plus retry-related reads).  
Rule-of-thumb per successfully processed message: at least 3 operations.

Approximate formula:

- `ops/day ~= writes + reads + deletes + retry-reads`

If each task message requires multiple delivery attempts (for example delayed rechecks), free-plan headroom can tighten quickly.  
Use conservative polling cadence and avoid over-fragmenting workflows into too many queue messages.

## Guardrails for correctness

1. Keep credits/trials/billing DB function semantics unchanged.
2. Consumer handlers must be idempotent:
   - safe on duplicate delivery
   - safe on replay after partial success
3. Always update task rows with status transitions guarded by expected current state.
4. Configure DLQ for non-transient failures.
5. Keep cancellation checks in every long-running consumer step.

## Suggested phased adoption

1. Phase Q1:
   - Qwen generate + design preview move to queue.
2. Phase Q2:
   - Modal status polling/finalization move to queue.
3. Phase Q3:
   - Optional webhook and storage cleanup queues.

## References

1. Queues overview:
   - https://developers.cloudflare.com/queues/
2. Queues pricing:
   - https://developers.cloudflare.com/queues/platform/pricing/
3. Queues limits:
   - https://developers.cloudflare.com/queues/platform/limits/
4. Batching, retries, delays:
   - https://developers.cloudflare.com/queues/configuration/batching-retries/
5. Dead letter queues:
   - https://developers.cloudflare.com/queues/configuration/dead-letter-queues/
6. Consumer concurrency:
   - https://developers.cloudflare.com/queues/configuration/consumer-concurrency/
7. JS APIs (`ack`, `retry`, `retryAll`):
   - https://developers.cloudflare.com/queues/configuration/javascript-apis/
8. Free plan availability announcement (2026-02-04):
   - https://developers.cloudflare.com/changelog/post/2026-02-04-queues-free-plan/
