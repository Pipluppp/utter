# Cloudflare Queues x Qwen API Compatibility (Verified)

Date: 2026-03-02  
Verification date: 2026-03-01

## Verdict

Cloudflare Queues is compatible with the current Qwen non-realtime integration and model set used in this codebase.

Primary reason: the Qwen flow is already async-task shaped (synthesize -> download temp URL -> persist object -> finalize DB), which maps directly to a queue consumer.

## What was verified

## Codebase assumptions (current)

1. Default Qwen target models in runtime config:
   - VC: `qwen3-tts-vc-2026-01-22`
   - VD: `qwen3-tts-vd-2026-01-26`
2. Current generate Qwen path runs in `EdgeRuntime.waitUntil(...)` and should move to queue consumer.
3. Current design-preview Qwen path runs in `EdgeRuntime.waitUntil(...)` and should move to queue consumer.
4. Qwen synthesis flow expects provider `output.audio.url`, then downloads and persists bytes.

## Vendor/API assumptions (official docs)

1. Qwen VC/VD custom voice APIs use:
   - `qwen-voice-enrollment`
   - `qwen-voice-design`
2. Synthesis for this integration uses:
   - `qwen3-tts-vc-2026-01-22`
   - `qwen3-tts-vd-2026-01-26`
3. Non-streaming response contains temporary `output.audio.url` and expiry metadata (`expires_at`), with temporary URL validity stated as 24h.

## Cloudflare Queue constraints relevant to Qwen

1. Free plan: 10,000 queue operations/day.
2. Message retention on free: 24h.
3. Message size limit: 128 KB.
4. At-least-once delivery: duplicates possible.
5. Consumer limits support async provider orchestration (wall-time and CPU limits exceed this workload when handler code is efficient).
6. `delaySeconds` max is 12h (`43200`).

## Compatibility mapping

| Qwen workflow | Queue compatibility | Notes |
|---|---|---|
| Generate (VC/VD synthesis) | Yes | Message payload is small (text + ids + model + voice id). |
| Design preview (voice design create + preview persist) | Yes | Keep preview audio bytes out of queue messages; fetch/process in consumer only. |
| Cancellation checks | Yes | Keep DB `cancellation_requested` checks before each expensive step in consumer. |
| Credit refunds/trial restore | Yes | Existing idempotency keys are compatible with at-least-once redelivery. |

## Guardrails required in implementation

1. Enforce model/voice match in consumer before provider call:
   - voice `provider_target_model` must equal requested synthesis `model`.
2. Keep queue messages metadata-only:
   - never include audio bytes/base64 in message body.
3. Retry policy:
   - retry network/timeout/5xx
   - do not retry 4xx validation errors
4. Keep finalization idempotent:
   - terminal-state guards
   - "already finalized" checks before storage write + DB completion update
5. Concurrency/rate guard:
   - cap consumer concurrency to stay under provider RPM limits.
6. Ensure temp URL handling is immediate:
   - download and persist as part of same consumer attempt cycle.

## Net assessment

For Qwen specifically, moving from `waitUntil` to Queues is a reliability upgrade with no model-level incompatibility.  
The migration is mostly orchestration refactor, not provider contract change.

## References

External:

1. https://developers.cloudflare.com/queues/platform/limits/
2. https://developers.cloudflare.com/queues/platform/pricing/
3. https://developers.cloudflare.com/queues/configuration/javascript-apis/
4. https://www.alibabacloud.com/help/en/model-studio/qwen-tts-api
5. https://www.alibabacloud.com/help/en/model-studio/qwen-tts-voice-cloning
6. https://www.alibabacloud.com/help/en/model-studio/qwen-tts-voice-design

Internal:

1. `docs/qwen-api.md`
2. `supabase/functions/_shared/tts/provider.ts`
3. `supabase/functions/_shared/tts/providers/qwen_synthesis.ts`
4. `supabase/functions/api/routes/generate.ts`
5. `supabase/functions/api/routes/design.ts`
6. `docs/2026-03-01/cloudflare-queues-migration-plan.md`
