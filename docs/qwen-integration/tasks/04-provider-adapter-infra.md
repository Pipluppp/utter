# 04 - Provider Adapter Infrastructure

## Goal

Introduce a provider abstraction layer so API routes do not directly depend on Modal or Qwen transport details.

## In Scope

- Shared provider interfaces and type contracts.
- Resolver logic based on `TTS_PROVIDER_MODE`.
- Modal and Qwen adapter module boundaries.
- Error normalization strategy.

## Out of Scope

- Full route integration per endpoint.
- Frontend changes.

## Interfaces Impacted

- Internal edge API interfaces only.
- Route handlers for clone/design/generate/tasks/cancel.

## Files/Modules Expected to Change

New modules:
- `supabase/functions/_shared/tts/types.ts`
- `supabase/functions/_shared/tts/provider.ts`
- `supabase/functions/_shared/tts/providers/modal.ts`
- `supabase/functions/_shared/tts/providers/qwen.ts`
- `supabase/functions/_shared/tts/providers/qwen_customization.ts`
- `supabase/functions/_shared/tts/providers/qwen_realtime.ts`
- `supabase/functions/_shared/tts/providers/qwen_audio.ts`
- `supabase/functions/_shared/tts/providers/errors.ts`

Refactors:
- routes currently importing `_shared/modal.ts`

## Step-by-Step Implementation Notes

1. Define provider-neutral types:
- `CloneVoiceInput/Result`
- `DesignPreviewInput/Result`
- `GenerateTaskInput/Result`
- `GenerateStreamInput/Result`
- `CancelTaskInput/Result`

2. Define provider interface.

```ts
interface TtsProvider {
  name: 'modal' | 'qwen'
  cloneVoice(input: CloneVoiceInput): Promise<CloneVoiceResult>
  createDesignedVoice(input: DesignCreateInput): Promise<DesignCreateResult>
  generateTask(input: GenerateTaskInput): Promise<GenerateTaskResult>
  generateStream?(input: GenerateStreamInput): Promise<ReadableStream<Uint8Array>>
  cancel?(input: CancelTaskInput): Promise<void>
}
```

3. Implement resolver:
- Read `TTS_PROVIDER_MODE`.
- Return exactly one provider implementation.
- Throw explicit startup/runtime error for invalid mode.
4. Pin qwen env defaults in resolver/config layer:
- `DASHSCOPE_BASE_URL=https://dashscope-intl.aliyuncs.com`
- `DASHSCOPE_REGION=intl`
- `QWEN_VC_TARGET_MODEL=qwen3-tts-vc-realtime-2026-01-15`
- `QWEN_VD_TARGET_MODEL=qwen3-tts-vd-realtime-2026-01-15`
- `QWEN_DEFAULT_RESPONSE_FORMAT=mp3`
- `QWEN_MAX_TEXT_CHARS=2000`

5. Implement Modal adapter as compatibility wrapper around existing `_shared/modal.ts` logic.

6. Implement Qwen adapter with protocol split:
- REST customization helper for clone/design/list/delete.
- WS realtime helper for synthesis.
- In this phase, provider `delete` exists only for diagnostics/admin tooling, not user delete path.

7. Grounded SDK constraint from `docs/qwen-api.md`:
- Do not attempt DashScope Python/Java SDK usage in Edge runtime.
- Implement Qwen integration with `fetch()` + native Deno `WebSocket`.
- For this custom voice realtime flow, do not route through OpenAI-compatible `/compatible-mode/v1`.
- Use official endpoints:
- `POST /api/v1/services/audio/tts/customization`
- `wss://.../api-ws/v1/realtime?model=...`

8. Normalize provider errors into stable categories before route response mapping.

## Data and Failure Modes

Failure modes:
1. Route bypasses adapter and keeps direct provider calls.
- Mitigation: ban direct imports from routes after refactor.
2. Type contract too narrow for one provider.
- Mitigation: optional capability flags and mode checks.
3. Unmapped provider errors leak raw payloads.
- Mitigation: centralized normalizer with redaction.

## Validation Checks

### Preconditions

- Task 01 and 02 contracts approved.
- Task 03 schema fields available for provider metadata persistence.

### Command list

```bash
rg -n "from \"../../_shared/modal.ts\"" supabase/functions/api/routes
rg -n "getTtsProvider|interface TtsProvider|normalizeProviderError" supabase/functions/_shared
npm run test:edge
```

### Expected success output/state

- Route modules use provider resolver instead of direct Modal client calls.
- Qwen adapter modules are present with REST+WS split.
- Edge tests pass with no contract regressions.

### Failure signatures

- Remaining direct imports to `_shared/modal.ts` in route files.
- Provider selection duplicated in route handlers.
- Raw provider stack traces returned to API callers.

## Exit Criteria

- Provider abstraction is the only integration point for TTS providers.
- Qwen adapter design reflects Edge runtime constraints from `docs/qwen-api.md`.
- Error handling is normalized and reusable.

## Rollback Note

If adapter refactor destabilizes routes, switch env to Modal and deploy known-good code. See `docs/qwen-integration/restoration.md`.
