# 05 - Qwen Clone Flow

## Goal

Implement qwen-mode voice cloning on top of the existing clone upload/finalize flow by creating a provider voice through Qwen customization REST and persisting required synthesis metadata.

## In Scope

- `POST /api/clone/finalize` qwen-mode behavior.
- Signed URL strategy for reference audio.
- Mapping Qwen clone response to `voices` table provider fields.

## Out of Scope

- Legacy one-step `/api/clone` flow in FastAPI.
- Frontend recording/transcription behavior.

## Interfaces Impacted

- `POST /api/clone/upload-url` (unchanged external contract).
- `POST /api/clone/finalize` (same external contract, new qwen internals).
- Internal `cloneVoice()` adapter API.

## Files/Modules Expected to Change

- `supabase/functions/api/routes/clone.ts`
- `supabase/functions/_shared/tts/providers/qwen_customization.ts`
- `supabase/functions/_shared/tts/providers/qwen.ts`

## Step-by-Step Implementation Notes

1. Keep upload-url route unchanged.
- Browser uploads reference audio to Storage first.

2. In qwen mode, `clone/finalize` sequence:
1. Validate request body (`voice_id`, `name`, `language`, `transcript`).
2. Verify uploaded reference object exists and meets size/type policy.
3. Create signed URL with short TTL for provider ingestion.
4. Call customization REST create with `model = qwen-voice-enrollment`.
5. Use pinned target model `qwen3-tts-vc-2026-01-22`.
6. Persist voice row with:
- `tts_provider = 'qwen'`
- `provider_voice_id = output.voice`
- `provider_target_model = output.target_model`
- `provider_voice_kind = 'vc'`
- `provider_region`
- `provider_request_id`
- `provider_metadata` (usage/request diagnostics)

Request payload shape:

```json
{
  "model": "qwen-voice-enrollment",
  "input": {
    "action": "create",
    "target_model": "qwen3-tts-vc-2026-01-22",
    "preferred_name": "my_voice_label",
    "audio": { "data": "<signed_or_data_url>" },
    "text": "Reference transcript",
    "language": "en"
  }
}
```

Expected response fields:

```json
{
  "output": {
    "voice": "qwen-tts-vc-...",
    "target_model": "qwen3-tts-vc-2026-01-22"
  },
  "usage": { "count": 1 },
  "request_id": "uuid"
}
```

3. Grounded from `docs/qwen-api.md`:
- Clone does not return preview audio.
- Synthesis later must use the same returned `target_model`.

4. Deletion policy:
- Do not call Qwen `delete` during normal user delete in this phase.
- App delete is soft delete only; user loses access through app filtering.

## Data and Failure Modes

Failure modes:
1. Signed URL expires before provider fetch.
- Mitigation: adequate TTL and immediate call after URL creation.
2. Transcript/audio mismatch provider rejection.
- Mitigation: pass transcript carefully; return provider error detail safely.
3. DB insert failure after provider voice creation.
- Mitigation: mark finalize failure and log provider `request_id` for manual reconciliation.
4. Wrong region endpoint/key mismatch.
- Mitigation: strict env validation during startup.

## Validation Checks

### Preconditions

- Task 03 migration with voice provider fields is applied.
- Qwen secrets configured for selected region.

### Command list

```bash
npm run test:edge
rg -n "qwen-voice-enrollment|provider_voice_id|provider_target_model" supabase/functions
```

Manual API smoke:

```bash
# 1) POST /api/clone/upload-url
# 2) Upload file to signed URL
# 3) POST /api/clone/finalize
# 4) GET /api/voices and verify provider metadata fields
```

### Expected success output/state

- Finalize succeeds and voice row contains qwen provider metadata.
- Voice is eligible for qwen generation without additional enrollment call.

### Failure signatures

- Voice row created without `provider_voice_id` or `provider_target_model`.
- Qwen clone succeeds but subsequent generate fails due to missing model mapping.
- Finalize leaves orphaned provider voices after DB failure.

## Exit Criteria

- Clone finalize in qwen mode is deterministic and synthesis-ready.
- All required provider metadata is persisted at creation time.

## Rollback Note

Switch provider mode to Modal and keep uploaded references intact. See `docs/qwen-integration/restoration.md`.
