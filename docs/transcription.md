# Voxtral (Mistral) real-time transcription + "Record reference audio" for voice cloning

Date: **2026-02-05**

## Why this exists

Utter’s Qwen3‑TTS voice cloning flow requires **(1) a reference audio file** and **(2) an accurate transcript of that audio** (`ref_text`). Today, the transcript is manual. This plan adds:

1. **Record reference audio** (in-browser) anywhere we currently require “upload audio”.
2. **Real‑time transcription while recording**, so the user sees what the system heard.
3. **Batch “final pass” transcription** on the completed recording/upload to maximize accuracy.
4. A clean backend abstraction so we can later swap providers or self‑host (Voxtral weights are open).

Primary sources to understand Voxtral:
- Announcement: `https://mistral.ai/news/voxtral-transcribe-2`
- API docs (audio): `https://docs.mistral.ai/capabilities/audio/`
- API endpoint schema: `https://docs.mistral.ai/api/endpoint/audio/transcriptions`

Reference implementation (microphone -> PCM chunks -> Voxtral realtime):
- `https://github.com/owenbrown/transcribe` (see also `owenbrown-transcribe_repo.txt` in this folder)

---

## Voxtral model + API understanding (what we can actually use)

### Models we care about

From Mistral’s “Voxtral Transcribe 2” announcement and docs:

- **Batch transcription** (highest quality, supports extra features):
  - Model: `voxtral-mini-2602` (aka “Voxtral Mini Transcribe V2”)
  - Pricing (API): **$0.003 / minute**
  - Features called out: diarization, context biasing, word timestamps, multilingual (13 languages), long files (up to hours).

- **Real‑time transcription** (lowest latency streaming):
  - Model: `voxtral-mini-transcribe-realtime-2602`
  - Pricing (API): **$0.006 / minute**
  - Designed for sub‑second (even sub‑200ms) incremental output.

Important nuance for our feature: **use the realtime model for “while recording”**, and then (optionally) run the batch model once we have the complete audio to produce the final transcript we store with the voice.

### Mistral API usage (key point: “yes, just an API key”)

We can use Voxtral entirely via a Mistral API key (no self‑hosting required):

- **Batch**: `POST /v1/audio/transcriptions` (multipart file upload or `file_url`/`file_id`), or via the `mistralai` SDK.
- **Streaming (SSE)**: `POST /v1/audio/transcriptions#stream` (useful for “transcribe this file and stream partials”).
- **Realtime (websocket)**: via `mistralai[realtime]` using `client.audio.realtime.transcribe_stream(...)` against `wss://api.mistral.ai`.

The endpoint schema currently documents the following request fields (useful for us):

- `model`: choose batch or realtime model.
- `language`: optional; can improve accuracy when known.
- `timestamp_granularities`: supports `segment` and `word` (we probably won’t need for voice cloning v1).
- `context_bias`: list of terms/phrases (helpful for names / custom vocabulary).
- `diarize`: optional; not needed for single-speaker reference audio, and realtime docs note diarization is not compatible with realtime.
- `format`: `json | text | verbose_json`.

---

## Current utter flow (what exists today)

### Backend

- `backend/main.py`:
  - `POST /api/clone` expects `name`, `audio`, `transcript`, `language`.
  - For `TTS_PROVIDER == "qwen"` it requires `transcript.length >= 10`.
  - Saves audio to `uploads/references/{voice_id}.{ext}` and transcript in `voices.reference_transcript`.

### Frontend (React SPA)

- `frontend/src/pages/Clone.tsx`:
  - Drag/drop upload of WAV/MP3/M4A.
  - Transcript text area is manual; required when provider is `qwen`.

### Legacy UI (Jinja)

- `backend/templates/clone.html` + `backend/static/js/app.js` implement similar upload+transcript.

---

## Product spec (the feature set we want)

### UX goals

1. **Upload OR record** reference audio.
2. **Auto-fill transcript** (no copy/paste needed).
3. **Live transcript while recording** (so user can re-record if it’s going wrong).
4. Transcript remains **editable** (because voice cloning quality is sensitive to accuracy).
5. Keep the existing “Clone Voice” API unchanged or minimally changed.

### UX details (Clone page)

Add a “Reference audio” panel with two tabs or segmented control:

- **Upload** (existing)
  - Add a “Transcribe audio” button (and/or “Auto transcribe on select” toggle).
  - Runs batch Voxtral; fills transcript textarea.

- **Record**
  - Record controls: `Start`, `Stop`, `Redo`.
  - Show mic level meter + timer (enforce max 5 minutes to match backend validation).
  - While recording, show:
    - connection state (“connecting”, “listening”, “reconnecting”, “error”)
    - transcript stream (partial)
  - On stop:
    - create a `File` (WAV) and set it as the selected reference audio
    - run an optional “final pass” batch transcription on the full WAV to improve accuracy
    - populate the transcript textarea with the final pass output (but keep the live transcript visible for comparison if we want)

### Beyond Clone page (“all audio-upload features”)

Right now the only user audio upload is `/clone`. The plan should still be generalized:

- Build a reusable frontend component that can be dropped into any future “upload audio” flows.
- Backend transcription endpoints should be generic (not voice-clone-specific).

---

## Architecture proposal

### High-level

Browser captures audio → sends PCM chunks to FastAPI (WebSocket) → FastAPI streams to Mistral realtime WS → FastAPI returns text deltas to browser → browser displays/accumulates transcript and saves WAV file → browser posts `/api/clone` with audio+transcript.

Batch flow (upload or final pass): browser posts audio file to FastAPI → FastAPI calls Mistral batch transcribe → returns transcript.

### Why not call Mistral directly from the browser?

- We must not expose the Mistral API key to clients.
- If Mistral later provides ephemeral tokens / user-scoped auth, we can revisit. For now: **backend proxy**.

### Compatibility with a “Supabase Edge Functions only” backend

This feature is compatible with that direction, with two important adaptations:

1. **Runtime/language**: Supabase Edge Functions run on Deno/TypeScript, so the backend implementation would use `fetch` (REST) + `WebSocket` APIs (realtime) instead of Python + `mistralai[realtime]`.
2. **Connection limits**: hosted Edge Functions have wall-clock limits (plan/limits dependent). For realtime transcription, keep sessions short (and/or use a paid plan) or run the realtime WS bridge as a tiny separate service.

Practical approach:

- **Batch transcription** (`POST /api/transcriptions`): very well-suited to an Edge Function (simple request → response).
- **Realtime transcription** (WS bridge): can live in an Edge Function if your plan/runtime limits cover your max recording time; otherwise keep this as a small dedicated websocket service while the rest of the app runs on Supabase.

---

## Backend plan (FastAPI)

### 1) Configuration

Add env vars (local dev in `backend/.env`, and documented in `backend/.env.example`):

- `MISTRAL_API_KEY` (required to enable transcription)
- `MISTRAL_TRANSCRIBE_MODEL=voxtral-mini-2602`
- `MISTRAL_REALTIME_MODEL=voxtral-mini-transcribe-realtime-2602`
- `MISTRAL_SERVER_URL=https://api.mistral.ai` (and/or `wss://api.mistral.ai` for realtime; the SDK uses both)
- `TRANSCRIPTION_ENABLED=true|false` (feature flag)

### 2) Dependencies

Update `backend/requirements.txt`:

- `mistralai[realtime]`

We should keep it backend-only; frontend should not depend on Mistral SDK.

### 3) New backend module: `backend/services/transcription.py`

Responsibilities:

- Create a single Mistral client instance (or a small pool) using `MISTRAL_API_KEY`.
- Expose:
  - `transcribe_file(file_bytes, filename, language?, context_bias?, timestamps?, diarize?) -> TranscriptionResult`
  - `realtime_transcribe(audio_stream: AsyncIterator[bytes], audio_format, model, ...) -> AsyncIterator[RealtimeEvent]`
- Normalize outputs into a stable internal shape:
  - `text`
  - `segments` (optional)
  - `words` (optional)
  - `language_detected?`
  - `provider_metadata` (model id, request id, billing minutes, etc if available)

This keeps Mistral-specific objects from leaking all over route handlers.

### 4) Batch transcription API

Add:

- `POST /api/transcriptions`
  - multipart/form-data:
    - `audio` (file)
    - `language` (optional; default `Auto` → omit to let model auto-detect)
    - `context_bias[]` (optional)
  - response:
    - `text` (string)
    - (optional) `segments` / `words` when requested
    - `model`

Implementation notes:

- Use the batch model (`voxtral-mini-2602`).
- Enforce same constraints as cloning reference audio:
  - file types: wav/mp3/m4a (or be explicit about what we accept)
  - size: 50MB
  - duration: 3–300s (we can reuse `validate_reference_audio`)
- If the clone page wants to allow shorter “test” clips, we can relax transcription endpoint constraints separately.

### 5) Realtime transcription API (WebSocket)

Add a WS endpoint, e.g.:

- `WS /api/transcriptions/realtime`

Protocol (simple + versioned):

1. Client connects.
2. Client sends a JSON “start” message:
   ```json
   {
     "type": "start",
     "v": 1,
     "language": "English",
     "audio_format": { "encoding": "pcm_s16le", "sample_rate": 16000 },
     "model": "voxtral-mini-transcribe-realtime-2602"
   }
   ```
3. Server replies:
   ```json
   { "type": "ready", "v": 1 }
   ```
4. Client streams **binary frames** (raw PCM s16le mono at 16kHz), ideally ~100ms per frame (mirroring `owenbrown/transcribe`).
5. Server sends JSON events back:
   - `{ "type": "delta", "text": "..." }` (partial)
   - `{ "type": "final", "text": "..." }` (on stop)
   - `{ "type": "error", "message": "..." }`

Server responsibilities:

- Bridge incoming audio bytes into an `AsyncIterator[bytes]` that feeds `client.audio.realtime.transcribe_stream(...)`.
- Accumulate deltas into a final transcript string.
- Handle disconnects and stop messages gracefully:
  - if the browser disconnects, cancel the Mistral stream.
  - if Mistral errors, forward error + close.

### 6) Vite dev proxy for WS

Update `frontend/vite.config.ts` proxy for `/api` to support websockets (Vite proxy typically needs `ws: true`).

### 7) (Optional) “Final pass” batch transcription

Even with a great realtime model, a final pass on the full file is usually higher quality.

Plan:

- In the frontend after stop, call `POST /api/transcriptions` with the recorded WAV.
- Replace transcript textarea content with final batch output (keep a “show live draft” toggle if useful).

### 8) Backend observability + cost guardrails

Add structured logs for:

- transcription duration (wall time)
- audio seconds
- model used
- success/failure codes

Add a simple concurrency limiter:

- realtime streams can be expensive; cap concurrent sessions via an `asyncio.Semaphore`.

### 9) Multi-user deployments: API key strategy (10–20 users)

You generally **do not** want each end-user to bring their own Mistral key for a product feature like this.

Recommended default:

- **Single server-side `MISTRAL_API_KEY`** owned by Utter (used by all users).
  - Pros: simplest UX, no key handling UI, no storing secrets per user, easiest support.
  - Cons: all costs accrue to you; you must protect against abuse.

What makes the “single key” approach safe/viable:

- **Never expose the key to the browser** (all calls go through FastAPI).
- Add **rate limits + quotas** per user (or per IP if no auth yet):
  - max concurrent realtime sessions per user (usually 1)
  - max realtime minutes per day
  - max batch minutes per day
  - max recording length (already 5 minutes for cloning reference)
- Add a **global concurrency cap** (the semaphore above) so one user can’t starve the server.
- Log per-user usage so we can later add billing / enforce limits.

Optional advanced option (BYOK):

- Allow users to paste their own `MISTRAL_API_KEY` (BYOK) and store it encrypted server-side.
  - Pros: costs shift to the user; isolates “abuse” to their own account.
  - Cons: much more security work (key storage, encryption, rotation, revocation, UI/UX, support).

Hybrid approach (often best later):

- Default to the **shared Utter key**, but enable BYOK for power users or enterprise accounts.

---

## Frontend plan (React + TS + Tailwind v4)

### 1) Reusable component: `ReferenceAudioInput`

Create a component used by Clone page (and future audio upload pages):

- `mode`: `upload | record`
- outputs:
  - `file: File | null`
  - `durationSeconds?: number`
  - `transcriptDraft?: string`
  - `transcriptFinal?: string`

### 2) Upload + transcribe flow

When a file is selected:

- Validate ext/size (existing)
- Provide:
  - a `Transcribe` button (calls `/api/transcriptions`)
  - optional toggle “Auto-transcribe on select”

### 3) Record flow (audio capture)

Implementation options (ranked):

1. **Web Audio + AudioWorklet** (preferred): capture float PCM, downsample to 16k, convert to s16le.
2. **ScriptProcessorNode** (fallback; deprecated but still widely supported).
3. **MediaRecorder** only (not enough for realtime PCM unless we also decode/convert, which is awkward).

We want:

- Realtime WS expects PCM s16le @ 16kHz mono.
- Our backend validation accepts WAV; we can generate a WAV file client-side at the end.

Approach:

- Start microphone stream.
- Run an audio processing pipeline that:
  - captures mono float frames
  - downsamples to 16k
  - converts to int16 PCM bytes
  - sends bytes over WebSocket as binary messages in ~100ms chunks
  - stores PCM bytes locally to later encode a WAV
- On stop:
  - close WS cleanly (send `{type:"stop"}` first)
  - WAV-encode the captured PCM bytes into a Blob/File (`audio/wav`)
  - set this File into the same `file` state used for upload

### 4) Transcript UI behavior

- While recording: show a “Live transcript” area updated by deltas.
- When `final` arrives: populate transcript textarea with final text.
- Always allow manual edits.
- Show helper text: “For best cloning, transcript should match audio exactly.”

### 5) Error handling & fallbacks

Expected failure modes:

- mic permission denied
- WS proxy misconfigured (dev)
- realtime session interrupted
- Mistral key missing / disabled in backend

Fallback ladder:

1. If realtime WS fails, still let the user record locally (we can keep capturing PCM).
2. After stop, run batch `POST /api/transcriptions` (works over plain HTTP).
3. If that fails too, user can manually type transcript (current behavior).

### 6) Integration into `frontend/src/pages/Clone.tsx`

Replace the current dropzone-only UI with:

- Reference audio panel (upload/record)
- Transcript area with:
  - `Transcribe` button (upload mode)
  - `Live transcript` indicator (record mode)

Keep:

- existing validation messaging
- language selection (also send to transcription endpoints)

---

## Legacy (Jinja) parity plan (optional but recommended)

If we want feature parity for the legacy `/clone` page:

- Add a “Transcribe audio” button next to the transcript textarea that calls `POST /api/transcriptions`.
- Add a “Record” mode later (more JS work).

This keeps the legacy UI usable while React evolves.

---

## Testing & validation plan

### Backend

- Unit-test `services/transcription.py` by mocking the Mistral client.
- Integration-test:
  - `POST /api/transcriptions` with a small WAV fixture in `test/inputs/reference/`.
  - WS protocol: connect, send `start`, send a few silent frames, ensure we receive events and clean close.

### Frontend

Given we don’t currently have a full automated test harness for mic capture:

- Add a small dev-only “audio loopback” mode for manual QA:
  - feed a static WAV file into the WS pipeline instead of microphone (deterministic).
- Manual acceptance checklist:
  - upload → transcribe → clone works
  - record → live transcript → final transcript → clone works
  - disconnect → recover gracefully

---

## Rollout plan

1. Ship batch transcription endpoint + “Transcribe audio” button first (fast win).
2. Add record (no realtime) next: record locally, then batch-transcribe on stop.
3. Add realtime WS streaming once batch+record are stable.
4. Gate the whole feature behind `TRANSCRIPTION_ENABLED` and presence of `MISTRAL_API_KEY`.

---

## Milestones (implementation order)

### Milestone A — Batch transcription (upload)

- Backend:
  - add `MISTRAL_API_KEY` config + `mistralai` dependency
  - implement `POST /api/transcriptions`
- Frontend:
  - add `Transcribe` button on Clone page (upload mode)
  - call endpoint and fill transcript textarea

### Milestone B — Record audio (no realtime yet)

- Frontend:
  - implement record controls
  - encode WAV client-side
  - on stop: call batch transcription, fill transcript
- Backend:
  - no changes beyond batch endpoint

### Milestone C — Realtime transcription (WS)

- Backend:
  - implement WS `/api/transcriptions/realtime`
  - bridge audio bytes → Mistral realtime client
- Frontend:
  - stream PCM to WS
  - display deltas live
  - on stop: request `final`, then optional batch refine

### Milestone D — Consolidation + polish

- Shared reusable `ReferenceAudioInput` component
- Improved UX copy + error messaging
- Add `context_bias` UI (optional advanced)
- Docs update: how to set `MISTRAL_API_KEY`, enable transcription, cost notes

---

## Open questions / decisions to resolve early

1. **Do we store anything beyond final transcript text?** (segments/words can be useful for future features but increases schema complexity.)
2. **Do we require the final batch pass, or make it optional?** (cost vs quality tradeoff)
3. **Recorded audio sample rate**: store 16k WAV (simple) vs store higher-fidelity WAV and only downsample for realtime.
4. **Max recording length**: match clone validator (5 minutes) or allow longer for transcription-only flows.
5. **Provider abstraction**: do we want a generic “TranscriptionProvider” interface now, or keep it Mistral-only until we need alternatives?
