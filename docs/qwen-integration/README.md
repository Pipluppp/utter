# Qwen Integration Orchestration

This package defines the migration plan from Modal-only orchestration to dual-provider orchestration (Modal + official Qwen API) for Supabase Edge Functions, using non-streaming generation only.

It is decision-complete and implementation-ready for the current product direction.

## Purpose and Scope

Purpose:
1. Introduce official Qwen API support without breaking current production behavior.
2. Keep a safe Modal fallback during rollout.
3. Use non-streaming generation and stored-result playback in Qwen mode.
4. Provide deterministic rollback and restoration procedures.

Scope:
- Supabase Edge Function API routes under `supabase/functions/api/routes`.
- Shared provider modules under `supabase/functions/_shared`.
- Supabase schema migrations under `supabase/migrations`.
- Frontend generation UX under `frontend/src/pages/Generate.tsx` and related task/state modules.
- Testing and rollout operations.

Out of scope for this phase:
- Realtime/WebSocket synthesis and frontend live chunk playback.
- Introducing external Python/Java worker services.
- Destructive removal of Modal code and schema fields.

## Grounded Facts from `docs/qwen-api.md`

1. Qwen custom voice is two surfaces.
- Customization REST (`/api/v1/services/audio/tts/customization`) for clone/design/list/query/delete.
- Non-streaming synthesis REST (`/api/v1/services/aigc/multimodal-generation/generation`) for speech generation.

2. Clone/design produce voice metadata required for synthesis.
- Clone model: `qwen-voice-enrollment`.
- Design model: `qwen-voice-design`.
- Both return `output.voice` and `output.target_model`.
- Synthesis must use that exact `(voice, target_model)` pair.

3. Region and key matching are strict.
- International endpoint (`dashscope-intl.aliyuncs.com`) and Mainland endpoint (`dashscope.aliyuncs.com`) are separate lanes.
- API keys are region-specific.
- This rollout is pinned to the international lane: `dashscope-intl.aliyuncs.com`.

4. SDK/runtime constraints for Supabase Edge Functions.
- Official DashScope SDK path is Python and Java.
- Supabase Edge implementation uses Deno `fetch()` for both customization and non-streaming synthesis.

5. Model pinning for this rollout.
- VC synthesis model: `qwen3-tts-vc-2026-01-22`.
- VD synthesis model: `qwen3-tts-vd-2026-01-26`.
- Generate text cap default: 600 characters (configurable).

6. Non-streaming output behavior.
- Synthesis returns `output.audio.url` and `output.audio.expires_at`.
- URL validity is temporary (24 hours); backend must persist a durable copy.

## Decision Log (Locked Defaults)

| # | Decision | Default |
|---|---|---|
| 1 | Provider mode | Atomic across clone/design/generate |
| 2 | Runtime switching | Env-based in one codebase (`TTS_PROVIDER_MODE`) |
| 3 | Environment defaults | Local = Modal, Production = Qwen |
| 4 | API contract | Keep v1 task contract (`/generate` + `/tasks/:id`) |
| 5 | Generation mode | Non-streaming only (no `/generate/stream`) |
| 6 | Frontend behavior | Submit/poll/final-playback in both providers |
| 7 | DB strategy | Additive, reversible migrations first |
| 8 | Worker model | Supabase Edge only (no Python/Java worker) |
| 9 | Modal posture | Retained as fallback through stabilization window |
| 10 | Qwen lane | International (`dashscope-intl.aliyuncs.com`) |
| 11 | Pinned target models | VC: `qwen3-tts-vc-2026-01-22`, VD: `qwen3-tts-vd-2026-01-26` |
| 12 | Generate limit | 600 chars max by default (`QWEN_MAX_TEXT_CHARS`) |
| 13 | Voice delete policy | App-level soft delete only; do not call Qwen delete API on user delete |
| 14 | Rate limits | No extra per-user throttles in this phase (credit system later) |

## Dependency Graph (Tasks 01-12)

```text
01 Provider Strategy
  -> 02 API Contracts
  -> 03 Database Migrations
  -> 04 Provider Adapter Infra
      -> 05 Qwen Clone Flow
      -> 06 Qwen Design Flow
      -> 07 Qwen Generate Task Flow
          -> 08 Qwen Non-Streaming Finalization
              -> 09 Frontend Non-Streaming UX
01/02/03/04/05/06/07/08/09
  -> 10 Testing + Validation
      -> 11 Rollout + Cutover
          -> 12 Post-Stabilization Cleanup
```

## Quick Execution Order

1. Complete docs and approval on tasks 01-04.
2. Implement clone/design/generate internals (tasks 05-07).
3. Implement non-streaming finalization + frontend UX updates (tasks 08-09).
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
- [08 Qwen Non-Streaming Finalization](./tasks/08-qwen-non-streaming-finalization.md)
- [09 Frontend Non-Streaming UX](./tasks/09-frontend-non-streaming-ux.md)
- [10 Testing and Validation](./tasks/10-testing-validation.md)
- [11 Rollout and Cutover](./tasks/11-rollout-cutover.md)
- [12 Post-Stabilization Cleanup](./tasks/12-post-stabilization-cleanup.md)
- [Restoration Playbook](./restoration.md)

## Completion Checklist

- [ ] Tasks 01-04 approved and unchanged during implementation.
- [ ] Additive migration plan approved before code changes.
- [ ] Qwen clone/design flows persist `provider_voice_id` and `provider_target_model`.
- [ ] v1 polling contract remains backward compatible.
- [ ] Qwen generate uses non-streaming synthesis endpoint only.
- [ ] Frontend uses submit/poll/final-playback (no live chunk playback).
- [ ] Test suite green in Modal mode and Qwen mode.
- [ ] Staging cutover completed with zero blocker defects.
- [ ] Production cutover completed with restoration path verified.
- [ ] Cleanup is deferred until stabilization criteria in task 12 are met.
