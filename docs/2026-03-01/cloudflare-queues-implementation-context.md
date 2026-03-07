# Cloudflare Queues Implementation Context (Feature-by-Feature)

Date: 2026-03-02  
Purpose: Provide developer-ready context for replacing current async orchestration with Cloudflare Queues.

## 1) Current behavior baseline (what exists now)

## 1.1 Generate

Current key files:

1. `supabase/functions/api/routes/generate.ts`
2. `supabase/functions/api/routes/tasks.ts`

Current behavior:

1. `POST /api/generate` debits credits, inserts `generations` + `tasks`.
2. Qwen path runs background logic via `EdgeRuntime.waitUntil(...)`.
3. Modal path updates task with provider job ID.
4. Frontend polls `GET /api/tasks/:id`.
5. `GET /api/tasks/:id` performs provider calls and may finalize task/generation.

## 1.2 Design preview

Current key files:

1. `supabase/functions/api/routes/design.ts`
2. `supabase/functions/api/routes/tasks.ts`

Current behavior:

1. `POST /api/voices/design/preview` debits/trial charges and creates task.
2. Qwen path starts background work via `waitUntil`.
3. Modal path is launched from `GET /api/tasks/:id` ("claim on first poll" pattern).
4. Poll endpoint can both read and mutate.

## 1.3 Cancellation and refunds

Current key files:

1. `supabase/functions/api/routes/tasks.ts`
2. `supabase/functions/api/routes/generate.ts`
3. `supabase/functions/api/routes/design.ts`

Current behavior:

1. Cancel sets `cancellation_requested` and/or terminal task state.
2. Refund/trial-restore paths are idempotent and rely on DB function keys.
3. Some failure handling is inside `waitUntil` paths.

## 2) Queue migration goal per feature

| Feature | Queue goal | Why it matters |
|---|---|---|
| Generate (Qwen) | Move full provider pipeline to consumer | Removes brittle in-request background execution |
| Generate (Modal) | Move status/finalization from `GET /tasks/:id` into consumer | Makes polling endpoint cheap and side-effect free |
| Design preview (Qwen + Modal) | Move async work start/finalization to queue consumers | Eliminates "first poll starts work" behavior |
| Billing webhook (optional) | Keep signature verify inline, queue heavy processing | Better response speed and retry durability |

## 3) Proposed endpoint responsibilities after migration

## 3.1 `POST /api/generate`

Responsibilities:

1. Validate auth/input/voice ownership.
2. Debit credits idempotently.
3. Insert generation/task rows.
4. Enqueue queue message.
5. Return `task_id`.

Not responsible for:

1. Provider network orchestration.
2. Audio download/upload/finalization.

## 3.2 `POST /api/voices/design/preview`

Responsibilities:

1. Validate input.
2. Apply trial/debit logic.
3. Insert task row.
4. Enqueue queue message.
5. Return `task_id`.

Not responsible for:

1. Provider preview generation.
2. Storage upload of preview output.

## 3.3 `GET /api/tasks/:id`

Responsibilities:

1. Auth + ownership check.
2. Return task status/result/error from DB.

Not responsible for:

1. Starting work.
2. Provider status calls.
3. Result finalization writes.

## 4) Consumer handler responsibilities (by message type)

## 4.1 `generate.qwen.start`

1. Load task/generation rows.
2. Guard: if terminal, `ack`.
3. Guard: if cancelled, mark cancelled/finalize refund path as needed, `ack`.
4. Call qwen synth.
5. Download audio.
6. Upload audio object.
7. Update generation/task to completed.
8. On transient failure: `retry(delaySeconds)`.
9. On permanent failure: mark failed + refund path + `ack`.

## 4.2 `design_preview.qwen.start`

1. Load task row.
2. Guard terminal/cancelled.
3. Call qwen design API.
4. Persist preview audio and provider metadata.
5. Update task completed.
6. Failure path: failed + refund/trial_restore idempotently.

## 4.3 `generate.modal.check` (Q2)

1. Load task row with provider job id.
2. Guard terminal/cancelled.
3. Check provider status.
4. If not ready: enqueue same message with delay.
5. If ready: download result, upload audio, update rows completed.
6. On provider failure: mark failed + refund.

## 5) DB and correctness invariants to preserve

Must remain unchanged:

1. Debit/refund/trial behavior through existing RPC wrappers:
   - `applyCreditEvent`
   - `trialOrDebit`
   - `trialRestore`
2. Idempotency key formats already in use.
3. Cancellation semantics via `cancellation_requested`.
4. Conditional status updates (`pending/processing` guards) to prevent stale overwrites.

## 6) Feature sizing and relevance

| Feature | Size of migration | Product relevance |
|---|---|---|
| Generate async path | Large | Critical (core action) |
| Design preview async path | Medium-Large | High |
| Modal poll/finalization extraction | Medium | High |
| Billing queue split (optional) | Small-Medium | Medium |

## 7) Suggested implementation extraction strategy

1. Extract current long-running logic into pure helper functions:
   - provider call steps
   - persistence steps
2. Reuse helpers in queue consumers.
3. Keep route handlers thin and queue-focused.
4. Remove `waitUntil` and poll-side side effects only after queue path is validated.

## 8) Rollout safety checklist

1. Gate each message type behind feature flags.
2. Enable Qwen queue handlers first.
3. Verify no regressions in credit/refund/cancel flows.
4. Then enable Modal recheck/finalization queue logic.
5. Finally simplify/remove legacy code paths.

## 9) References

1. [cloudflare-queues-migration-plan.md](./cloudflare-queues-migration-plan.md)
2. [cloudflare-queues-evaluation.md](./cloudflare-queues-evaluation.md)
3. `explainer.md`
