# Qwen TTS (Alibaba Cloud Model Studio) API deep dive — Voice Cloning/Design + Realtime Synthesis

> **Last verified**: 2026-02-08  
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

Given our product constraints (generate then play), we run **fully on Supabase** — no external worker. Edge Functions handle both orchestration and synthesis via the Qwen WS API. A **text length limit** (initially 5,000 characters, ~6-7 min audio) ensures synthesis completes within Edge Function wall-clock constraints. This limit can increase after empirical speed testing.

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

For "generate then play", we accumulate the decoded bytes, then upload a final file to Storage.

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

**This is fine for our "generate then play" use case.** We use the streaming API in a "collect everything" mode:

1. Send all text via `input_text_buffer.append`
2. Send `session.finish`
3. Accumulate all `response.audio.delta` chunks
4. When `session.finished` arrives → we have the complete audio
5. Upload to Supabase Storage → return signed URL to frontend

We never play audio in real-time. The streaming nature is transparent to us — we just buffer until done.

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
- **Request `mp3`** in `session.update`. MP3 is frame-based; frames are self-describing and should concatenate into a valid MP3 file. MP3 plays directly in all browsers.
- **Fallback**: Request `pcm`, concatenate all chunks, prepend a 44-byte WAV header (with correct data size) to produce a valid WAV file.

**This needs empirical verification** (see Unknowns section). The official examples show PCM only.

---

## Supabase integration architecture (committed — fully Supabase, no Modal)

### Decision: no external worker

We remove Modal.com entirely. Supabase Edge Functions handle both orchestration (REST) and speech synthesis (WS). The trade-off: a **text length limit** ensures synthesis completes within Edge Function wall-clock constraints.

Why this works:
- Voice creation (REST): <10s round-trip, trivially within Edge limits
- Speech synthesis (WS): Qwen TTS generates faster than realtime; with a text limit, synthesis fits within Edge wall clock
- No audio processing needed — request MP3 directly from Qwen API
- Removes an entire service dependency (Modal account, Python runtime, separate deployment pipeline)

**Note:** `docs/architecture.md` still references Modal in several places (decision matrix, risk register, shared code). Those sections need updating — see "Alignment with architecture.md" below.

### What runs where

```
┌──────────────────────────────────────────────────────────────────────┐
│ Supabase Edge Functions (TypeScript/Deno)                            │
│                                                                      │
│ ✅ Voice clone/design   → REST fetch() to DashScope (<10s)           │
│ ✅ Speech synthesis     → WS to DashScope, accumulate MP3 chunks,    │
│                           upload to Storage, return signed URL       │
│ ✅ Task management      → DB reads/writes (create, update status)    │
│ ✅ Storage signed URLs, input validation, auth                       │
│                                                                      │
│ Constraint: wall clock (free 150s / paid 400s)                       │
│ Mitigation: server-side text length limit                            │
└──────────────────────────────────────────────────────────────────────┘
```

### Synthesis flow (POST /api/generate)

```
Frontend ── POST /api/generate { voice_id, text } ──→ Edge Function
                                                         │
  1. Validate input (text ≤ limit, voice exists, user owns voice)
  2. Create task row (status: processing)
  3. Look up voice → get provider_voice_id + target_model
  4. Open WS: wss://dashscope-intl.../realtime?model=<target_model>
  5. Send session.update { voice, response_format: "mp3", ... }
  6. Send input_text_buffer.append (full text)
  7. Send session.finish
  8. Accumulate response.audio.delta chunks → base64 decode → buffer
  9. On session.finished:
     → Upload MP3 buffer to Supabase Storage
     → Update task row: status = completed, audio_path = ...
     → Return { task_id, audio_url (signed) }
```

Total wall-clock budget: WS handshake (~2s) + synthesis (variable) + Storage upload (~3-5s) + margin.

### Text length limits

Enforced server-side in the Edge Function. Set conservatively until the validation spike confirms actual synthesis speed.

| Plan | Wall clock | Overhead | Synthesis budget | Limit @ 3x RT | Limit @ 5x RT |
|---|---|---|---|---|---|
| **Free (150s)** | 150s | ~20s | ~130s | ~4,800 chars (~6.5 min) | ~8,000 chars (~10.8 min) |
| **Paid (400s)** | 400s | ~20s | ~380s | ~14,000 chars (~19 min) | ~23,500 chars (~31 min) |

**Initial default: 5,000 characters** — conservative, works at 3x realtime even on the free plan.

Assumptions behind the table:
- English speech ≈ 750 characters/minute at normal pace
- Overhead = WS handshake + session setup + Storage upload + DB writes
- "3x realtime" = 1 minute of audio takes ~20s to synthesize (conservative floor)
- "5x realtime" = 1 minute of audio takes ~12s to synthesize (probable, per Qwen3-TTS paper RTF data)
- Chinese text produces longer audio per character (~1.5-2s each vs ~0.15s for English letters); the limit should ultimately be based on estimated audio duration, not raw character count

After the validation spike confirms speed, increase the limit. On the paid plan at 5x realtime, we could safely support ~20,000+ characters (~25 min of audio).

### Edge Function memory

MP3 at 128 kbps ≈ 960 KB/min of audio:

| Text limit | Approx. audio | Buffer size |
|---|---|---|
| 5,000 chars | ~6.5 min | ~6.2 MB |
| 10,000 chars | ~13 min | ~12.5 MB |
| 20,000 chars | ~26 min | ~25 MB |

At our initial 5,000-char limit, the in-memory buffer is ~6 MB — well within Edge Function memory. If limits increase significantly in the future, consider streaming to Storage via resumable upload instead of in-memory accumulation.

### Why the JS SDK absence is a non-issue

The WS protocol is simple JSON messages. Deno's native `WebSocket` handles the connection:

```typescript
const ws = new WebSocket(wsUrl)

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: "session.update",
    session: { voice: voiceId, response_format: "mp3", sample_rate: 24000, mode: "server_commit" }
  }))
  ws.send(JSON.stringify({ type: "input_text_buffer.append", delta: text }))
  ws.send(JSON.stringify({ type: "session.finish" }))
}

const chunks: Uint8Array[] = []
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  if (msg.type === "response.audio.delta") {
    chunks.push(base64decode(msg.delta))
  }
  if (msg.type === "session.finished") {
    // concatenate chunks → upload to Storage → respond to frontend
  }
  if (msg.type === "error") {
    // update task as failed → respond with error
  }
}
```

~30 lines. No SDK needed.

### Job semantics

For our synchronous flow (Edge Function holds the WS connection and responds when done), the task row tracks state for observability and recovery:

| Trigger | Task state |
|---|---|
| Task row created, WS connection opening | `status = processing` |
| `session.finished` received, audio uploaded | `status = completed` |
| `error` event, WS disconnect, or Edge timeout | `status = failed` |

In the normal flow, the POST itself returns the result — the frontend gets `{ audio_url }` directly. The task row is for:
- Showing generation history
- Recovery if the frontend loses connection mid-request (user can poll `GET /api/tasks/:id`)
- Debugging (metadata stores provider info, timing, error snapshots)

### Future enhancement: live streaming playback

The current architecture accumulates all audio then responds. A future enhancement could **stream audio to the frontend in real-time**:

1. Edge Function returns a streaming HTTP response (`ReadableStream` / chunked transfer)
2. Audio chunks flow to the frontend as Qwen generates them
3. Frontend plays audio progressively (Web Audio API / MediaSource Extensions)
4. Each chunk sent to the client resets the Edge idle timer
5. Binding constraint becomes 400s wall clock only (not idle timeout)

Benefits:
- Instant first-audio latency (user hears speech within seconds of submitting)
- Higher effective text limits (streaming keeps the connection alive)
- Better UX for longer texts

Deferred until after the core accumulate-and-respond integration is working.

### Alignment with architecture.md

The fully-Supabase architecture is compatible with `docs/architecture.md` with these updates needed:

| architecture.md reference | Change needed |
|---|---|
| `_shared/modal.ts` (line 117) | → `_shared/dashscope.ts` |
| "Submit generation job → Needs Modal API call" (line 94) | → "Needs DashScope WS synthesis" |
| "Poll task status → Performs one Modal status check" (line 95) | → "Returns task row from DB" |
| "Design voice preview → Calls Modal VoiceDesign API" (line 98) | → "Calls DashScope voice design REST API" |
| Risk: "Edge fn CPU limit NOT fine for audio processing — must stay on Modal" (line 832) | → Edge doesn't process audio; Qwen outputs MP3 directly |
| Risk: "Long-running background jobs — use Modal" (line 843) | → Text limit ensures synthesis fits in wall clock |
| Custom secrets: `MODAL_TOKEN` (line 772) | → `DASHSCOPE_API_KEY` |

These updates should be applied when architecture.md is next revised.

---

## Unknowns that need empirical testing

These gaps in official documentation directly affect our text limit and output format decisions. The validation spike should answer them before writing production Edge Function code.

### 1. Synthesis speed ratio (CRITICAL — determines text limit)
- **Not documented.** How fast does the Qwen API generate audio relative to playback time?
- **Impact**: Directly determines our text length limit. At 5x realtime, 5,000 chars synthesizes in ~50s. At 1x realtime, it would take ~390s — too slow for the free plan.
- **Qwen paper suggests low RTF** (fast generation), but cloud API performance may differ from local inference benchmarks.
- **Test**: Time synthesis from WS open to `session.finished` for 1,000 / 5,000 / 10,000 character inputs. Calculate speed ratio.

### 2. MP3 chunk concatenation (CRITICAL — determines output format)
- **Not documented.** Official examples only show PCM output. When `response_format: "mp3"`, are the delta chunks valid MP3 frames that concatenate into a playable file?
- **Risk**: If chunks don't concatenate cleanly, fall back to PCM + WAV header wrapping.
- **Test**: Request `mp3`, concatenate all chunks, verify playback in browser and mobile.

### 3. Max text per session
- **Not documented.** No stated limit on text buffer size.
- **Our limit (5,000 chars) is well below any likely server cap**, but verify there's no hidden maximum below our limit.
- **Test**: Send 5,000 and 10,000 characters, confirm sessions complete without error.

### 4. Connection stability
- **Not documented.** For sessions lasting 1-3 minutes, are there disconnects?
- **Test**: Run several synthesis sessions at max text length, monitor for drops.

### 5. Voice design iteration cost
- Each "create" costs $0.20 and consumes quota (1,000 max).
- **Mitigation**: Consider our open-source Qwen3-TTS VoiceDesign for free unlimited previews; only call the official API for "save" operations.

### Validation spike (run before writing production code)

```
1. Get a DashScope API key (Singapore / International region)
2. Clone a voice (REST) → confirm voice ID + target_model
3. Synthesize 1,000 chars (WS, mp3) → verify MP3 plays, record wall-clock time
4. Synthesize 5,000 chars (WS, mp3) → verify, record time
5. Synthesize 10,000 chars (WS, mp3) → verify, record time (if 5k works)
6. Calculate speed ratio → set production text limit
7. Try pcm format → verify WAV header wrapping works as fallback
8. Update this doc with empirical results
```
