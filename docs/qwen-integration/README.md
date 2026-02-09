# Qwen Integration Orchestration

This package defines the full migration plan from Modal-only orchestration to dual-provider orchestration (Modal + official Qwen API) for Supabase Edge Functions.

It is decision-complete and implementation-ready. Engineering should not need new architecture decisions outside this folder.

## Purpose and Scope

Purpose:
1. Introduce official Qwen API support without breaking current production behavior.
2. Keep a safe Modal fallback during rollout.
3. Add realtime streaming generation in Qwen mode.
4. Provide deterministic rollback and restoration procedures.

Scope:
- Supabase Edge Function API routes under `supabase/functions/api/routes`.
- Shared provider modules under `supabase/functions/_shared`.
- Supabase schema migrations under `supabase/migrations`.
- Frontend generation UX under `frontend/src/pages/Generate.tsx` and related task/state modules.
- Testing and rollout operations.

Out of scope for this phase:
- Introducing external Python/Java worker services.
- Destructive removal of Modal code and schema fields.

## Grounded Facts from `docs/qwen-api.md`

1. Qwen custom voice is two surfaces, not one API.
- Customization REST (`/api/v1/services/audio/tts/customization`) for clone/design/list/delete.
- Realtime WebSocket (`/api-ws/v1/realtime?model=...`) for synthesis.

2. Clone/design produce voice metadata required for synthesis.
- Clone model: `qwen-voice-enrollment`.
- Design model: `qwen-voice-design`.
- Both return `output.voice` and `output.target_model`.
- Synthesis must use that exact `(voice, target_model)` pair.

3. Region and key matching are strict.
- International endpoint (`dashscope-intl.aliyuncs.com`) and Mainland endpoint (`dashscope.aliyuncs.com`) are separate lanes.
- API keys are region-specific.
- This rollout is pinned to the international lane: `dashscope-intl.aliyuncs.com`.

4. SDK constraint for Supabase Edge Functions.
- Official DashScope SDK path is Python and Java.
- There is no official JS/TS/Deno SDK path for this realtime TTS lane.
- Supabase Edge implementation must use Deno `fetch()` for REST and native `WebSocket` for realtime protocol.

5. Realtime protocol events must be handled explicitly.
- Client sends `session.update`, `input_text_buffer.append`, `session.finish`.
- Server streams `response.audio.delta` and terminal events like `response.done` and `session.finished`.
- Error events must be captured with request/event IDs for supportability.
6. Model and format pinning for this rollout.
- VC synthesis model: `qwen3-tts-vc-realtime-2026-01-15`.
- VD synthesis model: `qwen3-tts-vd-realtime-2026-01-15`.
- Realtime output format default: `mp3`.
- Generate text cap: 2000 characters (backend + frontend must match).
7. DashScope usage clarification for this stack.
- We still use Alibaba Cloud Model Studio (DashScope) and must provision a valid DashScope API key.
- Supabase Edge implementation does not install DashScope SDKs; it calls REST via `fetch()` and realtime synthesis via native `WebSocket`.
- For this custom voice realtime path, do not use OpenAI-compatible `/compatible-mode/v1`; use the official customization and realtime endpoints.

## Decision Log (Locked Defaults)

| # | Decision | Default |
|---|---|---|
| 1 | Provider mode | Atomic across clone/design/generate |
| 2 | Runtime switching | Env-based in one codebase (`TTS_PROVIDER_MODE`) |
| 3 | Environment defaults | Local = Modal, Production = Qwen |
| 4 | Existing API contract | Keep v1 task contract (`/generate` + `/tasks/:id`) |
| 5 | New API contract | Add v2 streaming (`/generate/stream`) for Qwen |
| 6 | Frontend behavior | Auto realtime playback in Qwen mode |
| 7 | Frontend toggle | Dev/staging only feature flag |
| 8 | DB strategy | Additive, reversible migrations first |
| 9 | Worker model | Supabase Edge only (no Python/Java worker) |
| 10 | Modal posture | Retained as fallback through stabilization window |
| 11 | Qwen lane | International (`dashscope-intl.aliyuncs.com`) |
| 12 | Pinned target models | VC: `qwen3-tts-vc-realtime-2026-01-15`, VD: `qwen3-tts-vd-realtime-2026-01-15` |
| 13 | Generate limit | 2000 chars max in both v1 and v2 flows |
| 14 | Voice delete policy | App-level soft delete only; do not call Qwen delete API on user delete |
| 15 | Rate limits | No extra per-user throttles in this phase (credit system later) |

## Dependency Graph (Tasks 01-12)

```text
01 Provider Strategy
  -> 02 API Contracts
  -> 03 Database Migrations
  -> 04 Provider Adapter Infra
      -> 05 Qwen Clone Flow
      -> 06 Qwen Design Flow
      -> 07 Qwen Generate Task Flow
          -> 08 Qwen Streaming v2
              -> 09 Frontend Realtime UX
01/02/03/04/05/06/07/08/09
  -> 10 Testing + Validation
      -> 11 Rollout + Cutover
          -> 12 Post-Stabilization Cleanup
```

## Quick Execution Order

1. Complete docs and approval on tasks 01-04.
2. Implement clone/design/generate internals (tasks 05-07).
3. Implement streaming v2 and frontend realtime behavior (tasks 08-09).
4. Run full matrix validation (task 10).
5. Perform staged cutover (task 11).
6. Keep fallback period, then cleanup in separate phase (task 12).

## Task Map

- [01 Provider Strategy](./tasks/01-provider-strategy.md)
- [02 API Contracts](./tasks/02-api-contracts.md)
- [03 Database Migrations](./tasks/03-database-migrations.md)
- [04 Provider Adapter Infrastructure](./tasks/04-provider-adapter-infra.md)
- [05 Qwen Clone Flow](./tasks/05-qwen-clone-flow.md)
- [06 Qwen Design Flow](./tasks/06-qwen-design-flow.md)
- [07 Qwen Generate Task Flow](./tasks/07-qwen-generate-task-flow.md)
- [08 Qwen Streaming v2](./tasks/08-qwen-streaming-v2.md)
- [09 Frontend Realtime UX](./tasks/09-frontend-realtime-ux.md)
- [10 Testing and Validation](./tasks/10-testing-validation.md)
- [11 Rollout and Cutover](./tasks/11-rollout-cutover.md)
- [12 Post-Stabilization Cleanup](./tasks/12-post-stabilization-cleanup.md)
- [Restoration Playbook](./restoration.md)

## Completion Checklist

- [ ] Tasks 01-04 approved and unchanged during implementation.
- [ ] Additive migration plan approved before code changes.
- [ ] Qwen clone/design flows persist `provider_voice_id` and `provider_target_model`.
- [ ] v1 polling contract remains backward compatible.
- [ ] v2 stream endpoint implemented and gated to Qwen mode.
- [ ] Frontend realtime behavior in Qwen mode implemented with fallback.
- [ ] Test suite green in Modal mode and Qwen mode.
- [ ] Staging cutover completed with zero blocker defects.
- [ ] Production cutover completed with restoration path verified.
- [ ] Cleanup is deferred until stabilization criteria in task 12 are met.
