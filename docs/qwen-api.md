# Qwen TTS (Alibaba Cloud Model Studio) API deep dive — Voice Cloning/Design + Realtime Synthesis

> **Last verified**: 2026-02-09
> **Purpose**: Integration reference for using Alibaba Cloud Model Studio (DashScope) Qwen TTS from our Supabase backend — voice cloning (VC), voice design (VD), and realtime speech synthesis via WebSocket.

## Sources (official docs)

Primary reference (feature comparison, pricing, models, voices, interaction flow, code examples):
```text
https://www.alibabacloud.com/help/en/model-studio/qwen-tts-realtime#38013cf163wku
```

Additional references:
```text
https://www.alibabacloud.com/help/en/model-studio/qwen-tts-realtime-client-events
https://www.alibabacloud.com/help/en/model-studio/qwen-tts-realtime-python-sdk
https://www.alibabacloud.com/help/en/model-studio/qwen-tts-realtime-java-sdk
https://www.alibabacloud.com/help/en/model-studio/qwen-tts-voice-cloning
https://www.alibabacloud.com/help/en/model-studio/qwen-tts-voice-design
https://www.alibabacloud.com/help/en/model-studio/model-pricing
https://www.alibabacloud.com/help/en/model-studio/getting-started/models
https://www.alibabacloud.com/help/en/model-studio/install-sdk
https://supabase.com/docs/guides/functions/limits
https://supabase.com/docs/guides/functions/background-tasks
```

## Executive summary (what exists, what we need)

Alibaba’s Qwen TTS offering in Model Studio is **not one API**. It’s two linked but separate surfaces:

1) **Customization (HTTP REST)** — creates/maintains *custom voices*  
   - **Voice cloning**: `model = "qwen-voice-enrollment"` → returns `output.voice` + `output.target_model`  
   - **Voice design**: `model = "qwen-voice-design"` → returns `output.voice` + `output.target_model` **and** `output.preview_audio`

2) **Speech synthesis (Realtime WebSocket)** — generates audio for *text + voice*  
   - WS endpoint: `/api-ws/v1/realtime?model=<MODEL_NAME>`
   - Streams `response.audio.delta` chunks until `response.done` / `session.finished`

Key gotchas that matter for product + architecture:

- **Voice cloning “create voice” does not generate preview audio.** It only enrolls a voice and returns an ID/name to use later in synthesis.
- **Voice design “create voice” returns preview audio — but it’s still a billable “create voice” operation.**
- The customization response includes **`target_model`**, and **you must synthesize with that exact model** later (model mismatch → synthesis fails).

Target architecture is **fully on Supabase** (no external worker): Edge Functions handle both orchestration and synthesis via the Qwen WS API. However, this repository has **not migrated yet**. Current implementation is still Modal-based (submit/poll/result), so this document now separates current state and target state explicitly.

---

## Regions, endpoints, and auth (you must pick one “lane”)

Model Studio is deployed in two primary modes for these TTS APIs:

- **International** (Singapore): `dashscope-intl.aliyuncs.com`
- **Mainland China** (Beijing): `dashscope.aliyuncs.com`

Important operational rule:
- **API keys are region-specific.** A Singapore key cannot be used against Beijing endpoints and vice versa.

### REST: voice customization (clone/design)

```text
POST https://dashscope-intl.aliyuncs.com/api/v1/services/audio/tts/customization   (International / Singapore)
POST https://dashscope.aliyuncs.com/api/v1/services/audio/tts/customization       (Mainland China / Beijing)
```

Headers:

```http
Authorization: Bearer <DASHSCOPE_API_KEY>
Content-Type: application/json
```

### WebSocket: realtime synthesis

```text
wss://dashscope-intl.aliyuncs.com/api-ws/v1/realtime?model=<MODEL_NAME>   (International / Singapore)
wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=<MODEL_NAME>        (Mainland China / Beijing)
```

Headers (WS handshake):

```text
Authorization: Bearer <DASHSCOPE_API_KEY>
```

---

## DashScope: what it is (and what it isn’t)

**DashScope** is Alibaba’s official SDK + gateway layer for Model Studio. For Qwen realtime TTS, it mainly gives you:

- a convenience client (`QwenTtsRealtime`) that manages the WebSocket connection
- a callback/event handler that receives server events (including `response.audio.delta`)
- typed session configuration helpers (`update_session` / `updateSession`)
- example code for `server_commit` vs `commit` modes and audio assembly

Model Studio also provides an **OpenAI-compatible API surface** and says you can use OpenAI SDKs (including Node.js) to call that surface. However:

- The official realtime TTS docs describe access via **DashScope Java/Python SDK** or the **DashScope WebSocket API** (`/api-ws/v1/realtime`) with events like `session.update`, `input_text_buffer.append`, and `response.audio.delta`.
- Model Studio’s “OpenAI-compatible API” is documented for other interfaces (for example, the Responses API for supported LLMs). As of 2026-02-08, the Qwen realtime TTS docs do not present a “call this via OpenAI SDK” path.

---

## SDK situation (what we use)

Official DashScope SDKs exist for **Python** and **Java** only. No JS/TS/Deno SDK.

**For our architecture (fully Supabase, no Python worker):**
- **Voice creation** (REST): Edge Functions use `fetch()`. No SDK needed.
- **Speech synthesis** (WS): Edge Functions use Deno's native `WebSocket`. No SDK needed.

The WS protocol is simple JSON messages (`session.update`, `input_text_buffer.append`, `response.audio.delta`, etc.). The Python SDK exists but is unnecessary for our stack — we don't run Python. The Edge Function synthesis handler is ~30 lines of WebSocket code.

---

## 3-lane map: Qwen TTS product surfaces (don’t conflate them)

Think in three lanes:

### Lane 1 — Customization (REST)

Used to create/manage custom voices.

- Voice cloning: `model = "qwen-voice-enrollment"` (`action = create|list|delete`)
- Voice design: `model = "qwen-voice-design"` (`action = create|list|query|delete`)

Returns `output.voice` and `output.target_model`. Voice design also returns `output.preview_audio`.

### Lane 2 — Realtime speech synthesis (WebSocket)

Used to generate audio via a realtime protocol:

- Connect to `.../api-ws/v1/realtime?model=<MODEL_NAME>`
- Send `session.update`
- Send text via `input_text_buffer.append`
- Server streams audio via `response.audio.delta` → `response.audio.done` → `response.done` → `session.finished`

### Lane 3 — Non-realtime "speech synthesis" (HTTP) — NOT for us

Model Studio also offers a non-realtime HTTP TTS API (`qwen3-tts-flash`) that returns a complete audio file URL. This is attractive but **does not support custom voices** (cloned/designed). It only supports preset/system voices. Verified 2026-02-08.

**For Utter, Lane 3 is a dead-end.** Our use cases (cloned + designed voices) require the realtime WS API (Lane 2).

---

## Voice cloning (REST): `qwen-voice-enrollment`

### What it does

“Voice cloning” enrolls a **custom voice** from a short audio clip (recommended 10–20s, max 60s). It returns a `voice` identifier that you later use in synthesis.

Important: cloning returns **no preview audio**.

### Endpoint

```text
POST https://dashscope-intl.aliyuncs.com/api/v1/services/audio/tts/customization   (Singapore)
POST https://dashscope.aliyuncs.com/api/v1/services/audio/tts/customization       (Beijing)
```

### Request JSON (skeleton)

```json
{
  "model": "qwen-voice-enrollment",
  "input": {
    "action": "create",
    "target_model": "qwen3-tts-vc-realtime-2026-01-15",
    "preferred_name": "guanyu",
    "audio": { "data": "https://public-url-to-audio.wav" },
    "text": "Optional transcript for mismatch checking",
    "language": "Optional: zh|en|de|it|pt|es|ja|ko|fr|ru"
  }
}
```

Notes:
- `model` is fixed.
- `target_model` is the synthesis model you must later use for this voice.
- `preferred_name` constraints: digits/letters/underscore only, max 16 chars; it becomes part of the final voice name.
- `audio.data` accepts:
  - a **Data URL** (`data:audio/wav;base64,...`) — must remain <10MB after base64 expansion
  - a **publicly accessible audio URL** (no auth required)
    - Supabase Storage signed URLs generally work well here because they require **no headers** (only a query token). Ensure the signed URL TTL covers the request.
- `text` (if provided) is used for verification; mismatch may return an error like `Audio.PreprocessError`.

### Response JSON (skeleton)

```json
{
  "output": {
    "voice": "qwen-tts-vc-...-voice-...",
    "target_model": "qwen3-tts-vc-realtime-2026-01-15"
  },
  "usage": { "count": 1 },
  "request_id": "..."
}
```

Store both:
- `output.voice` (provider voice id/name)
- `output.target_model` (required for later synthesis)

### Error handling (REST)

REST failures typically return an HTTP error status plus a JSON body containing an error `code`, `message`, and `request_id`.
For debugging and support, always log/store the `request_id` alongside the user/task.

### List voices / delete voice

List voices (used to monitor quota consumption):

```json
{
  "model": "qwen-voice-enrollment",
  "input": { "action": "list", "page_index": 0, "page_size": 10 }
}
```

Delete voice:

```json
{
  "model": "qwen-voice-enrollment",
  "input": { "action": "delete", "voice": "qwen-tts-vc-...-voice-..." }
}
```

### Audio requirements (cloning)

High-impact constraints:
- Formats: WAV (16-bit), MP3, M4A
- Duration: recommended 10–20 seconds (max 60 seconds)
- Size: < 10MB
- Sample rate: ≥ 24kHz
- Channel: mono

### Quotas and cleanup

- Total voices: 1,000 per account.
  - Note: the API does not return a “total voices used” counter; list voices and count.
- Auto cleanup: voices unused in synthesis for 1 year may be deleted.

### Billing (voice creation)

- Voice cloning creation: **$0.01 per voice** (`usage.count` billed).
- Failures don’t consume quota; deletion doesn’t restore quota.

---

## Voice design (REST): `qwen-voice-design`

### What it does

“Voice design” creates a **custom voice** from text description (`voice_prompt`) plus a preview script (`preview_text`).

Unlike voice cloning:
- it returns **preview audio** (`preview_audio.data` base64) as part of the create response
- but every “create” consumes **voice quota** and is billed as a voice creation

### Endpoint

```text
POST https://dashscope-intl.aliyuncs.com/api/v1/services/audio/tts/customization   (Singapore)
POST https://dashscope.aliyuncs.com/api/v1/services/audio/tts/customization       (Beijing)
```

### Core constraints (high-impact)

- `voice_prompt`:
  - max length: 2048 characters
  - language: **Chinese or English only**
- `preview_text`:
  - max length: 1024 characters
- Supported synthesis languages (voice design feature):
  - zh, en, de, it, pt, es, ja, ko, fr, ru

### Request JSON (skeleton)

```json
{
  "model": "qwen-voice-design",
  "input": {
    "action": "create",
    "target_model": "qwen3-tts-vd-realtime-2026-01-15",
    "voice_prompt": "A calm middle-aged male announcer...",
    "preview_text": "Dear listeners, hello everyone...",
    "preferred_name": "announcer",
    "language": "en"
  },
  "parameters": {
    "sample_rate": 24000,
    "response_format": "wav"
  }
}
```

Notes:
- `language` is a language code (e.g. `en`), and must match the language of `preview_text`.
- `target_model` must be used later for synthesis (model mismatch fails).
  - Note the naming mismatch across APIs:
    - customization uses `language` like `zh`, `en`, `de`, ...
    - realtime WS session config uses `language_type` like `Chinese`, `English`, ... (and sometimes `Auto`)

### Response JSON (skeleton)

```json
{
  "output": {
    "voice": "qwen-tts-vd-...-voice-...",
    "target_model": "qwen3-tts-vd-realtime-2026-01-15",
    "preview_audio": {
      "data": "<base64>",
      "sample_rate": 24000,
      "response_format": "wav"
    }
  },
  "usage": { "count": 1 },
  "request_id": "..."
}
```

### Other operations

- `action: "list"` supports paging and returns `total_count` (useful to monitor quota consumption).
- `action: "query"` fetches metadata for a specific voice.
- `action: "delete"` deletes a voice (but does not restore consumed free quota).

Request skeletons:

```json
{
  "model": "qwen-voice-design",
  "input": { "action": "list", "page_index": 0, "page_size": 10 }
}
```

```json
{
  "model": "qwen-voice-design",
  "input": { "action": "query", "voice": "qwen-tts-vd-...-voice-..." }
}
```

```json
{
  "model": "qwen-voice-design",
  "input": { "action": "delete", "voice": "qwen-tts-vd-...-voice-..." }
}
```

### Quotas and cleanup

- Total voices: 1,000 per account.
- Auto cleanup: voices unused in synthesis for 1 year may be deleted.

### Billing (voice creation)

- Voice design creation: **$0.20 per voice** (`usage.count` billed).
- Free quota (Singapore): 10 voice creations for 90 days after activation (failed creations don’t consume; deletion doesn’t restore).

Product implication:
- If the UI encourages repeated “try again” voice designs, each retry creates a new voice and consumes quota/cost. We must either:
  - delete failed/unused voices aggressively, and/or
  - constrain iteration loops (e.g., max N attempts), and/or
  - run previews via our open-source Qwen3-TTS VoiceDesign path instead of official voice design.

---

## Realtime speech synthesis (WebSocket): the API to call (clone vs design)

### The only synthesis API that matters for custom voices

For **cloned** or **designed** voices, the synthesis call is the same mechanism:

1) Connect to realtime WS with `model = <target_model returned by customization>`
2) Set `session.voice = <voice returned by customization>`
3) Send text and receive streamed audio chunks

### Recipe: synthesize a cloned voice

- Step 1: create voice (REST voice cloning) → get:
  - `voice = output.voice`
  - `model = output.target_model` (VC series, e.g. `qwen3-tts-vc-realtime-2026-01-15`)
- Step 2: realtime synth (WS):
  - connect: `wss://.../realtime?model=<output.target_model>`
  - set session: `voice = <output.voice>`

### Recipe: synthesize a designed voice

- Step 1: create voice (REST voice design) → get:
  - `voice = output.voice`
  - `model = output.target_model` (VD series, e.g. `qwen3-tts-vd-realtime-2026-01-15`)
  - preview audio (optional: save to Storage for “generate then play”)
- Step 2: realtime synth (WS):
  - connect: `wss://.../realtime?model=<output.target_model>`
  - set session: `voice = <output.voice>`

### Model/voice compatibility rules (avoid guaranteed failures)

**Utter uses two models:**

| Model | Purpose | `session.voice` value |
|---|---|---|
| **`qwen3-tts-vc-realtime-2026-01-15`** | Synthesis with **cloned** voices | custom voice ID from voice cloning |
| **`qwen3-tts-vd-realtime-2026-01-15`** | Synthesis with **designed** voices | custom voice ID from voice design |

Critical rules:
- VC models **only** accept cloned voice IDs. Preset names like "Cherry" will fail.
- VD models **only** accept designed voice IDs. Preset names will fail.
- The `target_model` from voice creation **must match** the `model` in the WS URL. Mismatch → synthesis fails.

Other model families exist (Flash, Instruct-Flash, legacy Qwen-TTS-Realtime) but are for **preset/system voices only** — not relevant to Utter.

Available snapshots for our models (International, as of 2026-02-08):
- **VC**: `qwen3-tts-vc-realtime-2026-01-15` (latest), `qwen3-tts-vc-realtime-2025-11-27`
- **VD**: `qwen3-tts-vd-realtime-2026-01-15` (latest), `qwen3-tts-vd-realtime-2025-12-16`

---

## Realtime WS protocol essentials (high-level; what our worker must implement)

### Session config (`session.update`)

Client sends `session.update` immediately after opening the WS connection.

Key fields (not exhaustive):

```json
{
  "event_id": "evt_001",
  "type": "session.update",
  "session": {
    "voice": "<custom voice ID from cloning/design>",
    "mode": "server_commit",
    "language_type": "Auto",
    "response_format": "mp3",
    "sample_rate": 24000,
    "speech_rate": 1.0,
    "volume": 50,
    "pitch_rate": 1.0
  }
}
```

Fields and constraints for VC/VD models:
- `voice`: the custom voice ID returned by voice cloning or voice design (not a preset name)
- `response_format`: `pcm`, `wav`, `mp3`, `opus` (we plan to use `mp3` — see Audio Assembly section)
- `sample_rate`: 8kHz, 16kHz, 24kHz, 48kHz (24kHz is default and recommended)
- `speech_rate`: [0.5, 2.0] (default 1.0)
- `volume`: [0, 100] (default 50)
- `pitch_rate`: [0.5, 2.0] (default 1.0)
- `bit_rate`: [6, 510] (default 128) — only applies to `opus`
- `language_type`: language names (`Chinese`, `English`, `Auto`, etc.) — not ISO codes
- `instructions` / `optimize_instructions`: **not applicable** to VC/VD models (Instruct-Flash only)

### Input flow (`server_commit` vs `commit`)

- **server_commit** (recommended default)
  - Client sends `input_text_buffer.append` repeatedly.
  - Server decides segmentation and when to synthesize.
  - Client can optionally send `input_text_buffer.commit` to “flush now”.
- **commit**
  - Client appends text to a buffer, then explicitly sends `input_text_buffer.commit` to synthesize that buffer.
  - Use when you need explicit control over breaks/pauses.

For a "single-shot" generate-then-play flow, the full event shape (from the official realtime docs) is:

**Client sends →**

1) `session.update` (configure voice, format, mode)
2) `input_text_buffer.append` (repeat as needed)
3) `input_text_buffer.commit` (optional in `server_commit`, required in `commit` to submit buffered text)
4) `session.finish` (notify server no more text)

**Server responds ←**

1) `session.created` → `session.updated` (after session.update)
2) `input_text_buffer.committed` (after commit)
3) `response.created` → `response.output_item.added` → `response.content_part.added`
4) `response.audio.delta` (repeated, base64 audio chunks)
5) `response.audio.done` → `response.content_part.done` → `response.output_item.done` → `response.done`
6) `session.finished`

Client events also include `input_text_buffer.clear` (clears the buffer without committing).

### Termination (`session.finish`)

Client sends `session.finish` to indicate no more text; server finishes remaining audio and closes the session (`session.finished`).

### Audio streaming

Server streams audio through the response lifecycle:
- `response.created` — server begins generating a response
- `response.output_item.added` → `response.content_part.added` — response structure established
- `response.audio.delta` — base64 audio chunks (repeated)
- `response.audio.done` — audio generation complete
- `response.content_part.done` → `response.output_item.done` → `response.done` — response finalized

For our streaming architecture, we decode each chunk and simultaneously stream it to the frontend + buffer it for Storage upload.

Practical implementation note:
- All Qwen3 models (including VC/VD) support `mp3` and `wav` output directly — request the browser-friendly format in `session.update` rather than requesting `pcm` and converting. If `pcm` is used, wrap it as WAV before storing.

### Error handling (WS)

The worker should treat these as "terminal failure" signals and persist them:
- `error` events (the protocol's error notification type)
- transport failures (WS disconnect, timeout)

Persist (at minimum):
- `request_id`/`event_id` values if provided by the protocol
- the last error payload snapshot (redacted if it can contain user text)
- a normalized user-facing message (e.g. “Synthesis failed, please try again”)

---

## Rate limits (realtime)

From the official feature comparison table (2026-02-08):

| Model | RPM |
|---|---|
| **Qwen3-TTS-VC-Realtime** | **180** |
| **Qwen3-TTS-VD-Realtime** | **180** |

180 RPM is generous for our use case (long-form generation, not chatbot). Design per-user throttles to stay well within this.

**Not documented**: max text per session, max session duration, max audio output duration. These need empirical testing (see "Unknowns" section).

---

## Pricing (International/Singapore — our region)

Pricing is split into **voice creation** (one-time) and **speech synthesis** (per-use), billed separately.

### Voice creation (Customization REST)

| Operation | Cost | Free quota (International) |
|---|---|---|
| Voice cloning | **$0.01 / voice** | 1,000 voices for 90 days |
| Voice design | **$0.20 / voice** | 10 voices for 90 days |

Failed creations are not billed. Deletion does not restore consumed free quota.

### Speech synthesis (Realtime WS)

Billed by **input characters** (output audio is not separately billed):

| Model | International (Singapore) |
|---|---|
| **Qwen3-TTS-VC-Realtime** | **$0.13 / 10,000 characters** |
| **Qwen3-TTS-VD-Realtime** | **$0.143353 / 10,000 characters** |

Character counting rules:
- Chinese characters (incl. Kanji/Hanja): count as **2** characters
- Everything else (letters, punctuation, spaces): count as **1** character

### Cost per 10 minutes (rough estimate for English narration)

```text
estimated_cost ≈ (C / 10000) * R + V
  where R = rate per 10k chars, C = total characters, V = one-time voice creation
```

| Scenario | Chars | VC synth cost | + voice creation | Total |
|---|---|---|---|---|
| 10 min, short sentences | ~8,000 | $0.104 | $0.01 | **~$0.11** |
| 10 min, dense text | ~12,000 | $0.156 | $0.01 | **~$0.17** |

For comparison: our previous Modal open-source Qwen3-TTS was ~$1/10 min. The official API is **~6-10x cheaper** for synthesis.

Validate with real production scripts to pin down chars-per-minute for our content.

---

## What "realtime" means (and why it's fine for us)

"Realtime" means the API **streams** audio back as it generates. You send text in, and audio chunks start flowing back immediately — designed for low-latency interactive use (voice assistants, chatbots).

**There is no batch/non-streaming API for custom voices.** The non-realtime HTTP API (`qwen3-tts-flash`) exists and returns a complete audio file URL, but it only supports preset voices — not cloned or designed voices. Verified 2026-02-08.

**We leverage the streaming nature directly.** The Edge Function streams decoded audio chunks to the frontend in real-time via a chunked HTTP response, while simultaneously buffering them for Storage upload:

1. Send all text via `input_text_buffer.append`
2. Send `session.finish`
3. On each `response.audio.delta`: base64-decode → write to HTTP response stream (frontend plays immediately) + push to in-memory buffer
4. On `session.finished`: close HTTP stream → concatenate buffer → upload to Supabase Storage → update task row

The frontend begins playback within seconds of submitting. The complete audio file is also persisted for replay/history.

---

## Audio assembly (how we get a playable file)

The Qwen API does **not** return a complete audio file. It streams base64-encoded audio chunks:

```json
{ "type": "response.audio.delta", "delta": "<base64 audio bytes>" }
{ "type": "response.audio.delta", "delta": "<base64 audio bytes>" }
... (repeated, could be hundreds of chunks)
{ "type": "response.audio.done" }
```

**We must decode and concatenate the chunks ourselves.** From the official Python examples:

```python
# Each chunk in the callback:
self.file.write(base64.b64decode(recv_audio_b64))  # append decoded bytes
```

### Output format strategy

All Qwen3 models (including VC/VD) support `pcm`, `wav`, `mp3`, `opus` via the `response_format` field in `session.update`. However:

- **Official examples only demonstrate PCM output** (raw bytes to `.pcm` files, no headers).
- **How mp3/wav/opus chunks are structured in streaming is not explicitly documented.**

Recommended approach:
- **Request `mp3`** in `session.update`. MP3 is frame-based; frames are self-describing and should concatenate into a valid MP3 file. MP3 plays directly in all browsers. **MP3 is also required for our streaming architecture** — the frontend needs a format it can play progressively, and MP3 frames are self-delimiting.
- **Fallback**: Request `pcm`, concatenate all chunks, prepend a 44-byte WAV header (with correct data size) to produce a valid WAV file. Note: PCM fallback breaks progressive frontend playback (must accumulate fully before playing).

**MP3 support is confirmed** by the official feature comparison table (VC/VD models support `pcm`, `wav`, `mp3`, `opus`). However, **chunk concatenation behavior still needs empirical verification** (see Unknowns section). The official examples show PCM only.

---


## Supabase integration architecture (target state)

### Current status in this repo (verified 2026-02-09)

The codebase is still Modal-backed today:

- `POST /api/generate` submits Modal jobs and stores `modal_job_id` (`supabase/functions/api/routes/generate.ts` + `supabase/functions/_shared/modal.ts`).
- `GET /api/tasks/:id` polls Modal and finalizes results (`supabase/functions/api/routes/tasks.ts`).
- Schema is Modal-centric (`tasks.modal_job_id`, `tasks.modal_poll_count`) and does not yet store Qwen custom-voice fields such as provider voice ID / target model (`supabase/migrations/20260207190731_initial_schema.sql`).
- Frontend generation UX expects async task polling (`frontend/src/pages/Generate.tsx`, `frontend/src/components/tasks/TaskProvider.tsx`), not a streamed `/api/generate` audio response.

This section describes the **target** migration architecture.

### Decision: no external worker (target)

Target decision remains: remove Modal.com entirely and run clone/design/synthesis through DashScope APIs from Supabase Edge Functions.

Why this is still viable:

- Voice creation REST calls are short-lived.
- Realtime WS synthesis can run inside Edge limits with strict server-side text limits.
- We can request browser-playable formats (`mp3`) directly from Qwen.
- We remove Modal deployment and job orchestration complexity.

### Verified Edge Function limits (Supabase)

As of 2026-02-09 (Supabase docs):

| Plan | Hard wall clock | Notes |
|---|---|---|
| Free | **150s** | The key constraint for long synthesis sessions on free tier. |
| Paid | **400s** | Larger envelope, but still finite. |

Important implications:

- Streaming output helps avoid idle-time stalls, but **does not increase hard wall clock**.
- Post-response work (`EdgeRuntime.waitUntil`) is supported, but should still be treated as bounded by function execution limits. Do not assume unlimited background runtime.

### Target synthesis flow (streaming)

```text
Frontend -> POST /api/generate { voice_id, text }
  1. Validate input + ownership
  2. Resolve voice mapping: provider_voice_id + target_model
  3. Open WS: wss://.../realtime?model=<target_model>
  4. Send session.update (voice, response_format, mode, language_type)
  5. Send input_text_buffer.append { text: ... }
  6. Send session.finish
  7. For each response.audio.delta:
     - base64 decode
     - stream bytes to client (optional endpoint variant)
     - append bytes for final persisted object
  8. On session.finished:
     - finalize storage upload
     - update task/generation rows
```

Protocol correctness reminder:

- Client -> server text event uses `input_text_buffer.append` with **`text`**.
- Server -> client audio event uses `response.audio.delta` with **`delta`** (base64 audio chunk).

### Text length limits under 150s/400s

Use conservative planning with ~10s overhead and ~750 chars/min spoken English.

| Plan | Wall clock | Overhead | Synthesis budget | Limit @ 3x RT | Limit @ 5x RT |
|---|---|---|---|---|---|
| Free | 150s | ~10s | ~140s | ~5,250 chars (~7.0 min audio) | ~8,750 chars (~11.7 min audio) |
| Paid | 400s | ~10s | ~390s | ~14,625 chars (~19.5 min audio) | ~24,375 chars (~32.5 min audio) |

Recommended guardrails:

- Keep default cap near **5,000 chars** until empirical throughput is measured in-prod.
- Current code still allows 10,000 chars; migration should explicitly re-evaluate and likely reduce this for free-tier safety.
- Ultimately prefer estimated audio-duration limits over raw character count (especially for CJK-heavy inputs).

### Audio assembly strategy

- Prefer `response_format: "mp3"` for browser playback and simpler transport.
- Continue treating MP3 chunk concatenation as an empirical requirement to validate before rollout.
- Keep PCM -> WAV fallback path documented for compatibility.

### API contract choice (must be explicit)

Because the frontend currently expects task polling, migration has two valid paths:

1. Keep existing async contract:
   - `POST /api/generate` returns `task_id`
   - Backend performs WS synthesis and persists output
   - Frontend polls tasks as it does today
2. Introduce streaming contract:
   - `POST /api/generate` returns streaming audio bytes
   - Frontend playback logic changes substantially
   - Task rows become optional/secondary telemetry

Pick one contract before implementation to avoid half-migrated behavior.

### Alignment updates needed in docs/architecture.md

| architecture.md reference | Needed update |
|---|---|
| `_shared/modal.ts` | Replace with DashScope integration helper(s). |
| "Submit generation job -> Needs Modal API call" | Replace with DashScope WS synthesis path. |
| "Poll task status -> Performs one Modal status check" | Update to chosen migration contract (polling task state vs streaming endpoint). |
| Risk notes saying long-running jobs must stay on Modal | Reframe around 150s/400s Supabase constraints + text caps. |
| Secrets list mentioning `MODAL_*` | Replace with `DASHSCOPE_API_KEY` (+ region choice). |

---

## Unknowns that need empirical testing

These still need validation before production rollout:

### 1. Real API speed ratio under Supabase constraints
- Measure wall-clock from WS open to `session.finished` for 1k/5k/10k chars.
- Free-tier planning must use **150s** hard cap.

### 2. MP3 chunk concatenation and progressive playback
- Validate concatenated MP3 across desktop/mobile browsers.
- Validate partial playback behavior with real network jitter.

### 3. Qwen per-session input envelope
- Official docs do not publish a practical max text buffer for our exact path.
- Confirm behavior at and above planned caps.

### 4. Connection stability near limit windows
- Run repeated near-cap sessions and observe disconnect/error frequencies.

### 5. Voice-design iteration economics
- Each create is billable and consumes quota.
- Confirm product limits to prevent accidental cost spikes.

### 6. `waitUntil`/post-response finalization behavior
- Validate operationally in Supabase Edge Functions for our workload.
- Ensure persistence/finalization completes reliably without assuming unbounded runtime.

### Validation spike checklist

```text
1. Acquire DashScope API key in target region (Singapore or Beijing)
2. Clone voice (REST) and record voice + target_model
3. Synthesize 1,000 chars (WS mp3), record wall-clock and output validity
4. Synthesize 5,000 chars (WS mp3), record wall-clock and output validity
5. Attempt 10,000 chars (WS mp3), confirm pass/fail envelope
6. Verify progressive playback in browser for streamed chunks
7. Verify fallback pcm->wav pipeline
8. Verify finalization behavior with and without waitUntil
9. Set production text cap from measured results (not assumptions)
10. Update this document with measured timings and chosen API contract
```
