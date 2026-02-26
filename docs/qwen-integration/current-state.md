# Qwen Integration Current State

Last updated: February 26, 2026

## Environment status

- Supabase project: `utter-dev` (`jgmivviwockcwjkvpqra`)
- Deployed Edge Function: `api`
- Active provider mode: `qwen`
- Active Qwen lane: `intl` (`https://dashscope-intl.aliyuncs.com`)
- Active Qwen text cap override: `QWEN_MAX_TEXT_CHARS=100`

## Verified deployment behavior

Live endpoint check:

```bash
curl -s https://jgmivviwockcwjkvpqra.supabase.co/functions/v1/api/languages
```

Verified response fields:
- `"provider": "qwen"`
- `"capabilities.supports_generate_stream": false`
- `"capabilities.default_generate_mode": "task"`
- `"capabilities.max_text_chars": 100`

## Implementation status

Implemented and merged in working tree:
- Provider switch via `TTS_PROVIDER_MODE`
- Qwen provider adapters (`_shared/tts/*`)
- Provider-aware clone/design/generate/tasks flows
- Additive provider schema migration
- Soft delete for voices (`deleted_at`)
- Frontend provider-aware generate UX + capability-aligned char cap

Reference:
- `docs/qwen-integration/implementation-guide.md`

## Validation status (local)

Executed successfully on February 26, 2026:

1. `npm run sb:reset`
2. `npm run test:db`
3. `npm run sb:serve:test`
4. `npm run test:edge` (`127 passed, 0 failed`)
5. `npm --prefix frontend run check`
6. `npm --prefix frontend run typecheck`
7. `npm --prefix frontend run build`

## Rollback control

Immediate rollback command:

```bash
supabase secrets set TTS_PROVIDER_MODE=modal
supabase functions deploy api
```

Reference:
- `docs/qwen-integration/restoration.md`
