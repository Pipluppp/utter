# Qwen ASR Implementation Plan for Voice-Cloning Reference Text

Date: **2026-03-12**

Status: implementation-ready plan for the active Cloudflare + Supabase runtime.

## Goal

Replace the current Mistral batch transcription path with Qwen ASR for the voice-cloning reference-audio flow, so:

1. A user can upload or record reference audio.
2. The app can transcribe that audio into editable reference text.
3. The final transcript is passed into Qwen voice enrollment during clone finalization.

This plan intentionally excludes:

- `qwen3-asr-flash-filetrans`
- `qwen3-asr-flash-realtime`
- live transcript streaming
- long-audio transcription flows outside voice cloning

## Final scope and non-goals

### In scope

- Replace the active batch transcription provider from Mistral to Qwen
- Keep the public route contract as `POST /api/transcriptions`
- Support upload transcription and record-then-transcribe on the Clone page
- Align clone validation and recorder behavior with Qwen clone-quality requirements
- Remove active Mistral transcription config and code paths
- Add testing coverage and a manual validation checklist

### Out of scope

- Realtime transcript while recording
- Filetrans async transcription
- New generic audio-upload product surfaces outside Clone
- Schema changes for timestamps, word-level data, or emotion storage

## Current repo state

### Backend

- `workers/api/src/routes/transcriptions.ts` exposes `POST /api/transcriptions`.
- That route is batch-only and currently calls `workers/api/src/_shared/mistral.ts`.
- `workers/api/src/routes/clone.ts` only requires a transcript string during `/api/clone/finalize`.
- Result: transcription is already isolated enough to swap providers without changing the clone finalization contract.

### Frontend

- `frontend/src/pages/Clone.tsx` supports:
  - upload + manual transcript
  - upload + batch transcription
  - local recording + batch transcription after stop
- There is no live transcript while recording.
- The current recorder downsamples to `16 kHz` mono WAV before saving the file.

### Important mismatch to fix

The `16 kHz` recorder was acceptable for the Mistral path, but it does not align with the clone-quality guidance already documented for Qwen voice enrollment, which expects higher-quality reference audio. The recorder format must therefore be updated as part of this migration.

## Provider decision summary

### Chosen model and protocol

Use:

- Model: `qwen3-asr-flash-2026-02-10`
- Fallback alias: `qwen3-asr-flash`
- Protocol: OpenAI-compatible HTTP
- Region lane: International / Singapore
- API base URL: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`
- Endpoint: `POST /chat/completions`
- Request mode: non-streaming (`stream: false`)

### Why this exact choice

- The voice-clone flow only needs a final transcript before submit.
- `qwen3-asr-flash` supports OpenAI-compatible calls and Data URL audio input.
- That fits Cloudflare Workers well with plain `fetch`.
- It avoids public-audio URL orchestration and avoids async polling.
- It avoids the complexity of live WebSocket transcription.

## Official Qwen model conclusions

### `qwen3-asr-flash`

Use for short audio transcription.

- Synchronous
- Supports recorded/uploaded audio up to `5 minutes` and `10 MB`
- Accepts Data URL Base64 input and public URL input
- Supports OpenAI-compatible HTTP calls for short-audio ASR
- Best match for the clone reference-text workflow

### `qwen3-asr-flash-filetrans`

Use for long asynchronous transcription jobs only.

- Async task submission + polling
- Supports up to `12 hours` and `2 GB`
- Requires public file URL input
- Adds orchestration complexity that the clone flow does not need

### `qwen3-asr-flash-realtime`

Use only when live incremental transcript UX is required.

- WebSocket / realtime session model
- Input audio must be `pcm` or `opus`
- Mono only
- `8 kHz` or `16 kHz`
- Best for live captions, meetings, or assistants
- Not needed to get the final transcript used for clone enrollment

## Final decisions

### Region

Stay on the international Qwen lane already used by TTS:

- Region: `intl`
- Endpoint/data region: Singapore
- API key source: Singapore-region DashScope key

### Phase 1 provider decision

Use:

- Model: `qwen3-asr-flash-2026-02-10`
- Fallback alias: `qwen3-asr-flash`
- Calling mode: OpenAI-compatible HTTP from the API Worker using plain `fetch`
- `stream: false`

Do not use in Phase 1:

- `qwen3-asr-flash-filetrans`
- `qwen3-asr-flash-realtime`

### Why this is the correct Phase 1 shape

- The existing Clone page only needs a final transcript before submit.
- Batch short-audio ASR is enough for that requirement.
- It avoids adding WebSocket/session state to the Worker and frontend.
- It avoids async task polling for a short clip.
- It keeps the migration small and low-risk while removing Mistral from the critical path.

## Product constraints to align now

The product should stop optimizing around the old Mistral transcription envelope and align to Qwen voice-clone constraints instead.

Recommended clone reference constraints:

- ideal length: `10-20 seconds`
- hard cap: `60 seconds`
- max size: `10 MB`
- single speaker, clean speech, minimal noise
- mono audio
- saved reference sample rate: `>= 24 kHz`
- supported extensions in UI/API: `.wav`, `.mp3`, `.m4a`

Why the stricter cap matters:

- It matches the Qwen clone use case better than the old `5 minute / 50 MB` UX.
- It keeps the recorded/uploaded clip comfortably within short-audio ASR limits.
- It makes Data-URL-based ASR requests practical from the Worker.

## Backend implementation plan

### 1. Replace the Mistral-specific module with a provider abstraction

Current:

- `workers/api/src/_shared/mistral.ts`

Target:

- `workers/api/src/_shared/transcription/provider.ts`
- `workers/api/src/_shared/transcription/providers/qwen.ts`

The abstraction should expose:

- `getTranscriptionConfig()`
- `transcribeAudioFile(file, language)`

Recommended exported types:

- `TranscriptionConfig`
- `BatchTranscriptionResult`
- `TranscriptionUnavailableError`
- `TranscriptionUpstreamError`

This keeps `routes/transcriptions.ts` stable while removing direct Mistral coupling.

### 2. Reuse the existing DashScope credentials and region config

Prefer these existing env vars:

- `DASHSCOPE_API_KEY`
- `DASHSCOPE_REGION`
- `TRANSCRIPTION_ENABLED`

Add only what is needed for ASR model selection:

- `QWEN_ASR_MODEL=qwen3-asr-flash-2026-02-10`
- `QWEN_ASR_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1`

Optional later, not needed for Phase 1:

- `QWEN_ASR_REALTIME_MODEL=qwen3-asr-flash-realtime-2026-02-10`

Then remove:

- `MISTRAL_API_KEY`
- `MISTRAL_SERVER_URL`
- `MISTRAL_TRANSCRIBE_MODEL`

from worker config, docs, and type declarations once the migration lands.

### 3. Implement the Qwen batch transcription client

Recommended request path:

- `POST ${QWEN_ASR_BASE_URL}/chat/completions`

Recommended payload shape:

```json
{
  "model": "qwen3-asr-flash-2026-02-10",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "input_audio",
          "input_audio": {
            "data": "data:audio/wav;base64,<base64_audio>"
          }
        }
      ]
    }
  ],
  "stream": false,
  "asr_options": {
    "enable_itn": false
  }
}
```

Implementation notes:

- Use plain `fetch`; do not add an SDK dependency.
- Encode the incoming `File` as a Data URL.
- Use the file MIME type when building the Data URL:
  - WAV: `audio/wav`
  - MP3: `audio/mpeg`
  - M4A: `audio/mp4`
- Keep `enable_itn: false` unless we later want normalized number formatting for supported languages.
- Add `asr_options.language` only when we have a reliable single-language mapping.
- Include an empty system message by default so the request shape supports future context biasing without a protocol change.
- Do not enable `stream`.

### 4. Parse the OpenAI-compatible response shape exactly

The route should normalize the Qwen response into:

```ts
type BatchTranscriptionResult = {
  text: string
  model: string
  language: string | null
}
```

Expected Qwen response source fields:

- transcript text: `choices[0].message.content`
- detected language: `choices[0].message.annotations[*].language`
- emotion: available in annotations but should not be persisted or returned in this phase
- model: top-level `model`
- usage: top-level `usage.seconds` and token fields, available for logs

Implementation rule:

- Parse `choices[0].message.content` defensively because vendor docs show minor response-shape variation between protocol examples.
- Return only `{ text, model, language }` from `/api/transcriptions`.
- Log request/usage metadata server-side; do not change the public response shape yet.

### 5. Add optional language mapping for Qwen ASR

Map UI language labels to Qwen `asr_options.language` only when the chosen language is a specific single language and not `Auto`.

Recommended initial mapping:

- `Chinese -> zh`
- `English -> en`
- `Japanese -> ja`
- `Korean -> ko`
- `French -> fr`
- `German -> de`
- `Spanish -> es`
- `Italian -> it`
- `Portuguese -> pt`
- `Russian -> ru`

If the UI selection ever becomes mixed/unknown, omit the parameter entirely.

### 6. Keep `/api/transcriptions` as the public contract

Do not change the route shape in Phase 1.

Keep:

- `POST /api/transcriptions`
- multipart form with `audio` and optional `language`

Change only:

- provider metadata returned by `/api/languages`
- implementation behind the route
- validation bounds so they match Qwen clone limits

### 7. Tighten server-side validation

Current route accepts:

- `50 MB`
- `.wav`, `.mp3`, `.m4a`

Target for clone-focused transcription:

- `10 MB`
- `.wav`, `.mp3`, `.m4a`
- reject obviously overlong reference clips where duration metadata is available

If duration cannot be derived cheaply in the Worker, at minimum:

- enforce `10 MB`
- enforce extension whitelist
- enforce frontend recording hard-cap at `60 seconds`
- keep backend clone finalize hard-cap at `10 MB`

The clone flow should no longer advertise or accept a transcription path that exceeds what the final Qwen voice-enrollment call is meant to handle.

### 8. Update `/api/languages`

Current:

- imports `getTranscriptionConfig()` from the Mistral module

Target:

- import from the new transcription provider abstraction
- report `provider: "qwen"` for transcription once cut over

Expected response after cutover:

```json
{
  "transcription": {
    "enabled": true,
    "provider": "qwen",
    "model": "qwen3-asr-flash-2026-02-10"
  }
}
```

### 9. Logging and error handling

For each upstream transcription call, log:

- provider
- model
- request outcome
- detected language when present
- `usage.seconds` when present
- provider request id if present

Error policy:

- missing config -> `503`
- invalid input -> `400`
- provider 4xx/5xx/network failure -> `502`
- no broad silent fallback to Mistral

The active route should either use Qwen or return an explicit error.

## Frontend implementation plan

### 1. Keep the existing UX structure

Do not redesign the clone flow yet.

Keep:

- Upload mode
- Record mode
- Editable transcript box
- `Transcribe` button in upload mode
- Auto-transcribe after stop in record mode

This keeps the migration focused on provider and audio-quality corrections.

### 2. Fix the recorder output format

Current behavior:

- downsample to `16 kHz`
- save `audio/wav`

Target behavior:

- keep mono capture
- save clone-quality WAV at `>= 24 kHz`
- keep the saved recording as the same file later uploaded for cloning

The ASR call can use that same file; Qwen short-audio ASR will handle WAV input.

Practical implementation note:

- the recorder no longer needs to downsample to `16 kHz`
- capture PCM at the browser/device sample rate and encode a mono WAV at a clone-quality sample rate
- keep the saved file under the product `10 MB` cap

### 3. Enforce a 60-second hard cap in record mode

Add:

- automatic stop at `60 seconds`
- helper copy that recommends `10-20 seconds`
- clear error/help text when the clip is too long

This is the simplest way to stay aligned with both Qwen clone quality and short-audio ASR limits.

### 4. Update copy and validation

Replace the old guidance that implied long reference recordings were acceptable.

New guidance should say:

- short, clean, single-speaker reference audio works best
- transcript should match the speech exactly
- recording stops are transcribed automatically
- best results come from roughly `10-20 seconds`
- maximum supported reference length is `60 seconds`
- maximum supported file size is `10 MB`

### 5. Keep realtime transcript out of Phase 1

Do not add WebSocket live transcript streaming yet.

Reason:

- the app already works with batch-after-stop
- realtime would require a second downsampled stream at `16 kHz`
- it adds meaningful complexity without being required for the migration goal

## Phase 2 option: live draft transcript

If later we want "see what the app heard while I am speaking", add a second phase:

1. Keep saving a clone-quality WAV for final use.
2. Simultaneously stream a downsampled `16 kHz` mono PCM feed to `qwen3-asr-flash-realtime-2026-02-10`.
3. Show live draft text while recording.
4. After stop, still run batch `qwen3-asr-flash-2026-02-10` and treat that result as the final editable transcript.

This keeps the final stored transcript on the more suitable batch model.

## Implementation checklist

### Worker files to update

- `workers/api/src/routes/transcriptions.ts`
- `workers/api/src/routes/languages.ts`
- `workers/api/src/_shared/mistral.ts` -> replace/remove
- `workers/api/worker-configuration.d.ts`
- `workers/api/.dev.vars.example`

Recommended new files:

- `workers/api/src/_shared/transcription/provider.ts`
- `workers/api/src/_shared/transcription/providers/qwen.ts`

### Frontend files to update

- `frontend/src/pages/Clone.tsx`
- `frontend/src/lib/audio.ts`
- `frontend/src/lib/types.ts` only if typing changes are necessary

## Testing plan

### Backend

- Unit test the new Qwen transcription provider with mocked upstream responses.
- Verify error normalization for 4xx, 5xx, and timeout cases.
- Verify `/api/transcriptions` still returns `{ text, model, language }`.
- Verify `language` mapping is omitted when unknown and included when specific.
- Verify `.wav`, `.mp3`, `.m4a` inputs are accepted and oversize files are rejected.
- Verify `/api/languages` reports transcription provider `qwen`.

### Frontend

- Upload a valid WAV, transcribe, then clone successfully.
- Record a short sample, auto-transcribe, then clone successfully.
- Confirm recorder auto-stops at `60 seconds`.
- Confirm transcript remains editable before submit.
- Confirm upload-mode validation matches the new `10 MB` limit.
- Confirm record-mode output remains acceptable for clone finalization.

### Regression checks

- `/api/clone/finalize` contract remains unchanged.
- `/api/languages` still drives capability flags correctly.
- No Mistral env vars or provider strings remain in the active transcription path after cutover.

## Manual end-to-end validation script

Run after implementation in local dev:

1. Start Supabase, API Worker, and frontend.
2. Sign in with a test user.
3. Open Clone page.
4. Upload a short WAV under `10 MB`.
5. Press `Transcribe`.
6. Confirm transcript appears and is editable.
7. Submit clone and confirm finalize succeeds.
8. Record a new short sample in-browser.
9. Confirm recording auto-transcribes after stop.
10. Confirm clone finalize succeeds with the recorded file.
11. Try an oversized file and confirm client/server validation blocks it.
12. Confirm `/api/languages` reports transcription provider `qwen`.
13. Inspect Worker logs and confirm Qwen request metadata is present and there is no Mistral activity.

## Concrete implementation order

1. Add the generic transcription provider module and Qwen implementation.
2. Swap `/api/transcriptions` and `/api/languages` to the new provider.
3. Remove Mistral transcription env vars and typings.
4. Update Clone page recording format and record-time cap.
5. Update frontend copy and validation to short-reference guidance.
6. Run manual upload/record cloning checks end to end.

## Acceptance criteria

- `POST /api/transcriptions` uses Qwen only.
- Clone upload and record flows both produce editable transcript text.
- Clone finalize continues to accept the same payload shape.
- No active transcription route depends on `MISTRAL_*` env vars.
- Clone reference audio UX and validation are aligned to `10 MB` and `60 seconds`.
- Local end-to-end testing passes for both upload and record flows.

## Official references

- Qwen ASR API reference: https://www.alibabacloud.com/help/en/model-studio/qwen-asr-api-reference
- Qwen speech recognition overview: https://www.alibabacloud.com/help/en/model-studio/qwen-speech-recognition
- Qwen voice cloning API reference: https://www.alibabacloud.com/help/en/model-studio/qwen-tts-voice-cloning
