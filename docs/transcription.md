# Transcription

Project reference for how transcription works in the active Cloudflare + Supabase runtime.

## Current state

- Transcription is used for the voice-cloning reference-audio flow.
- The active ASR provider decision is Qwen short-audio recognition via `qwen3-asr-flash`.
- The transcription route is batch-only.
- `qwen3-asr-flash-filetrans` and `qwen3-asr-flash-realtime` are intentionally not part of the active plan.

## Where it is used

- Clone page upload flow: user uploads reference audio, then can request transcription.
- Clone page record flow: user records audio in-browser, then the app transcribes the recorded file after stop.
- Clone finalize flow: the final edited transcript is passed into Qwen voice enrollment as the reference text.

## Backend contract

Public route:

- `POST /api/transcriptions`

Current route responsibilities:

- require authenticated user
- accept multipart form data with `audio`
- accept optional `language`
- validate allowed audio type
- call the active transcription provider
- return normalized JSON:

```json
{
  "text": "transcribed text",
  "model": "qwen3-asr-flash-2026-02-10",
  "language": "en"
}
```

The clone finalize route does not depend on provider-specific transcription metadata. It only needs the final transcript string.

## Provider and protocol

Active provider decision:

- Provider: Qwen
- Model: `qwen3-asr-flash-2026-02-10`
- Fallback alias: `qwen3-asr-flash`
- Protocol: OpenAI-compatible HTTP
- Region lane: International / Singapore
- Base URL: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`

Request characteristics:

- non-streaming
- audio sent as Data URL Base64
- optional language hint through `asr_options.language`
- `enable_itn: false`

Not used:

- `qwen3-asr-flash-filetrans`
- `qwen3-asr-flash-realtime`
- live transcript streaming

## Product constraints

The transcription flow should stay aligned with Qwen voice-clone constraints:

- ideal reference length: `10-20 seconds`
- hard cap: `60 seconds`
- max file size: `10 MB`
- allowed extensions: `.wav`, `.mp3`, `.m4a`
- saved recorded reference audio should be clone-quality and not optimized around the old `16 kHz` Mistral path

## Frontend behavior

Clone page behavior:

- Upload mode keeps a manual transcript box plus a `Transcribe` action.
- Record mode captures audio locally, saves a WAV file, and transcribes after stop.
- The transcript remains editable before clone submission.
- There is currently no live transcript while recording.

Important implementation note:

- The old recorder path downsampled to `16 kHz` for Mistral-oriented transcription.
- The Qwen-aligned direction is to save clone-quality audio for the actual reference file, then transcribe that saved file.

## Configuration

Relevant env vars:

- `DASHSCOPE_API_KEY`
- `DASHSCOPE_REGION`
- `TRANSCRIPTION_ENABLED`
- `QWEN_ASR_MODEL`
- `QWEN_ASR_BASE_URL`

Transcription should not depend on active `MISTRAL_*` env vars after the Qwen cutover is implemented.

## Code locations

- API route: `workers/api/src/routes/transcriptions.ts`
- Clone finalize route: `workers/api/src/routes/clone.ts`
- Languages metadata route: `workers/api/src/routes/languages.ts`
- Clone page: `frontend/src/pages/Clone.tsx`
- Audio helpers: `frontend/src/lib/audio.ts`

## Implementation plan

The implementation-ready migration plan lives here:

- `docs/2026-03-11/qwen-asr-implementation-plan.md`

## References

- Qwen ASR API reference: https://www.alibabacloud.com/help/en/model-studio/qwen-asr-api-reference
- Qwen speech recognition overview: https://www.alibabacloud.com/help/en/model-studio/qwen-speech-recognition
- Qwen voice cloning API reference: https://www.alibabacloud.com/help/en/model-studio/qwen-tts-voice-cloning
