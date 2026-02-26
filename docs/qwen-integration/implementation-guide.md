# Qwen API Integration Implementation Guide

## Goal

Implement dual-provider TTS orchestration so clone/design/generate can run on either Modal or official Qwen API, switched by env without code changes.

## Current deployed state (utter-dev)

As of February 26, 2026:

- Project: `jgmivviwockcwjkvpqra`
- `api` function deployed with provider-aware implementation
- `TTS_PROVIDER_MODE=qwen`
- `QWEN_MAX_TEXT_CHARS=100` (cost-control override from default 600)
- `/api/languages` confirms `provider=qwen` and `capabilities.max_text_chars=100`

## What Was Implemented

1. Provider switching
- Added `TTS_PROVIDER_MODE=modal|qwen` as the runtime switch.
- `/api/languages` now returns provider capabilities (`supports_generate_stream=false`, `default_generate_mode=task`, `max_text_chars`).

2. Backend provider infrastructure
- Added shared provider modules under `supabase/functions/_shared/tts/`:
  - provider config and mode resolution
  - Qwen customization + synthesis clients
  - Qwen temporary audio download helper
  - provider error normalization

3. API route updates (provider-aware)
- `clone/finalize`: in qwen mode creates provider voice and persists provider metadata.
- `voices/design/preview`: in qwen mode performs one provider `create` and stores preview + provider IDs on task result.
- `voices/design`: in qwen mode reuses preview task metadata (no second billable provider create).
- `generate`: in qwen mode does non-streaming synthesis -> download temp audio -> upload durable storage -> complete task.
- `tasks/:id`: emits provider-neutral fields and does DB-state polling behavior in qwen mode.
- `voices`: soft delete behavior (`deleted_at`) and filtering of deleted rows.

4. Database (additive migration)
- Added migration: `20260226153000_qwen_provider_additive_schema.sql`
- New columns for provider metadata in `voices`, `tasks`, `generations`.
- Added dual-provider indexes and soft-delete support.

5. Frontend updates
- Added provider/capability fields to types.
- Generate page now uses backend text cap from capabilities.
- Voice options are provider-aware (incompatible provider voices shown but disabled).
- Task provider can display provider status progression.
- Design flow includes `task_id` when saving designed voices.

6. Tests adjusted
- DB schema/index tests updated for new additive columns/indexes.
- Languages route test updated for capability payload.

## Local Validation Run (Completed)

Run date: February 26, 2026

1. `npm run sb:reset` (applied all migrations including qwen additive migration)
2. `npm run test:db` -> **PASS**
3. `npm run sb:serve:test` (in one terminal)
4. `npm run test:edge` -> **PASS** (`127 passed, 0 failed`)
5. Frontend checks:
- `npm --prefix frontend run check` -> **PASS**
- `npm --prefix frontend run typecheck` -> **PASS**
- `npm --prefix frontend run build` -> **PASS**

## How To Switch Providers (Local)

In `supabase/.env.local` set:

```env
TTS_PROVIDER_MODE=modal
```

or

```env
TTS_PROVIDER_MODE=qwen
```

Then restart function serving:

```bash
npm run sb:serve
```

## Required Secrets / Env For Deployment

Set these in Supabase project secrets.

### Runtime switch

- `TTS_PROVIDER_MODE` = `modal` or `qwen`

### Modal (fallback / rollback readiness)

- `MODAL_JOB_SUBMIT`
- `MODAL_JOB_STATUS`
- `MODAL_JOB_RESULT`
- `MODAL_JOB_CANCEL` (optional but recommended)
- `MODAL_ENDPOINT_VOICE_DESIGN`

### Qwen (official API)

- `DASHSCOPE_API_KEY`
- `DASHSCOPE_BASE_URL=https://dashscope-intl.aliyuncs.com`
- `DASHSCOPE_REGION=intl`
- `QWEN_VC_TARGET_MODEL=qwen3-tts-vc-2026-01-22`
- `QWEN_VD_TARGET_MODEL=qwen3-tts-vd-2026-01-26`
- `QWEN_MAX_TEXT_CHARS=600` (default; currently overridden to `100` in deployed project)

## Example Secret Setup Commands

```bash
supabase secrets set \
  TTS_PROVIDER_MODE=qwen \
  DASHSCOPE_API_KEY=<your_key> \
  DASHSCOPE_BASE_URL=https://dashscope-intl.aliyuncs.com \
  DASHSCOPE_REGION=intl \
  QWEN_VC_TARGET_MODEL=qwen3-tts-vc-2026-01-22 \
  QWEN_VD_TARGET_MODEL=qwen3-tts-vd-2026-01-26 \
  QWEN_MAX_TEXT_CHARS=600 \
  MODAL_JOB_SUBMIT=<modal_submit_url> \
  MODAL_JOB_STATUS=<modal_status_url> \
  MODAL_JOB_RESULT=<modal_result_url> \
  MODAL_JOB_CANCEL=<modal_cancel_url> \
  MODAL_ENDPOINT_VOICE_DESIGN=<modal_design_url>
```

Deploy function after secret changes:

```bash
supabase functions deploy api
```

## Post-Deploy Smoke Checklist

1. `GET /api/health` returns `{ ok: true }`
2. `GET /api/languages` returns expected `provider` and `capabilities`
3. Clone flow (`/api/clone/upload-url` + `/api/clone/finalize`) works
4. Design flow (`/api/voices/design/preview` -> task completed -> `/api/voices/design`) works
5. Generate flow (`/api/generate` + `/api/tasks/:id`) reaches terminal state with playable audio
6. Cancel flow works (`/api/tasks/:id/cancel`)
7. Over-limit text rejects with clear `detail`

## Fast Rollback

```bash
supabase secrets set TTS_PROVIDER_MODE=modal
supabase functions deploy api
```

Reference: `docs/qwen-integration/restoration.md`
