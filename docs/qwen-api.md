# Qwen TTS Non-Realtime Integration Guide (Custom Voices: VC/VD)

> Last verified against Alibaba Cloud docs: February 11, 2026
> Scope: Non-realtime only (no live chunk playback, no WebSocket implementation)
> Target synthesis models: `qwen3-tts-vc-2026-01-22`, `qwen3-tts-vd-2026-01-26`

## 1. Purpose

This document is the backend implementation reference for integrating Alibaba Cloud Qwen TTS custom voices in a non-streaming workflow.

It is designed to be self-contained for developers implementing:

1. Voice cloning management (create/list/delete).
2. Voice design management (create/list/query/delete).
3. Non-streaming speech synthesis using custom voices.
4. Durable storage handoff from temporary vendor audio URL.

## 2. Scope decisions (fixed)

In scope:

- HTTP customization APIs (`/services/audio/tts/customization`).
- HTTP non-streaming synthesis API (`/services/aigc/multimodal-generation/generation`).
- Custom voice model compatibility enforcement.
- Backend job-style flow: submit -> process -> store -> complete.

Out of scope:

- Realtime synthesis protocol details.
- Live chunk playback UX.
- SSE/WebSocket frontend integration.

## 3. Non-streaming means

For this integration, "non-streaming" means:

- The synthesis request is a regular HTTP request.
- The response contains metadata plus `output.audio.url` for a complete audio file.
- The returned URL is temporary (24 hours) and must be copied into durable storage.

## 4. Model compatibility rules (critical)

Use these models only:

- VC path: `qwen3-tts-vc-2026-01-22`
- VD path: `qwen3-tts-vd-2026-01-26`

Rules:

1. `target_model` used during custom voice creation must equal synthesis `model` later.
2. VC model accepts only VC-created voices.
3. VD model accepts only VD-created voices.

If model and voice family are mismatched, synthesis fails.

## 5. Regions, endpoints, auth

Use a single region lane end-to-end. API keys are region-specific.

### 5.1 Region endpoints

| Region | Customization endpoint | Non-streaming synthesis endpoint |
|---|---|---|
| International (Singapore) | `https://dashscope-intl.aliyuncs.com/api/v1/services/audio/tts/customization` | `https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation` |
| Mainland China (Beijing) | `https://dashscope.aliyuncs.com/api/v1/services/audio/tts/customization` | `https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation` |

### 5.2 Headers

- `Authorization: Bearer <DASHSCOPE_API_KEY>`
- `Content-Type: application/json`

### 5.3 SDK base URL

- Singapore: `https://dashscope-intl.aliyuncs.com/api/v1`
- Beijing: `https://dashscope.aliyuncs.com/api/v1`

## 6. End-to-end workflows

### 6.1 Voice cloning workflow (VC)

1. Call Create Voice with `model=qwen-voice-enrollment`, `input.action=create`, `input.target_model=qwen3-tts-vc-2026-01-22`.
2. Persist `output.voice`, `output.target_model`, `request_id`.
3. Call non-streaming synthesis with `model=qwen3-tts-vc-2026-01-22`, `input.voice=<persisted_voice>`.
4. Download `output.audio.url` before expiry.
5. Upload to durable storage.
6. Persist storage URL/path and mark task complete.

### 6.2 Voice design workflow (VD)

1. Call Create Voice with `model=qwen-voice-design`, `input.action=create`, `input.target_model=qwen3-tts-vd-2026-01-26`.
2. Optionally use `output.preview_audio.data` for preview.
3. Persist `output.voice`, `output.target_model`, `request_id`.
4. Call non-streaming synthesis with `model=qwen3-tts-vd-2026-01-26`, `input.voice=<persisted_voice>`.
5. Download `output.audio.url` before expiry.
6. Upload to durable storage.
7. Persist storage URL/path and mark task complete.

## 7. API reference: Voice Cloning (`qwen-voice-enrollment`)

Endpoint:

- `POST /api/v1/services/audio/tts/customization`

### 7.1 Create voice

Request:

```json
{
  "model": "qwen-voice-enrollment",
  "input": {
    "action": "create",
    "target_model": "qwen3-tts-vc-2026-01-22",
    "preferred_name": "my_clone_01",
    "audio": {
      "data": "data:audio/mpeg;base64,<base64_audio>"
    },
    "text": "optional transcript matching the input audio",
    "language": "en"
  }
}
```

Request parameters:

| Field | Required | Type | Notes |
|---|---|---|---|
| `model` | Yes | string | Fixed: `qwen-voice-enrollment` |
| `input.action` | Yes | string | Fixed: `create` |
| `input.target_model` | Yes | string | For this integration: `qwen3-tts-vc-2026-01-22` |
| `input.preferred_name` | Yes | string | <= 16 chars, digits/letters/underscore |
| `input.audio.data` | Yes | string | Data URL or public URL |
| `input.text` | No | string | If provided, server may validate mismatch |
| `input.language` | No | string | `zh|en|de|it|pt|es|ja|ko|fr|ru` |

Response:

```json
{
  "output": {
    "voice": "qwen-tts-vc-my_clone_01-voice-2025...",
    "target_model": "qwen3-tts-vc-2026-01-22"
  },
  "usage": {
    "count": 1
  },
  "request_id": "yourRequestId"
}
```

### 7.2 List voices

Request:

```json
{
  "model": "qwen-voice-enrollment",
  "input": {
    "action": "list",
    "page_size": 10,
    "page_index": 0
  }
}
```

Response:

```json
{
  "output": {
    "voice_list": [
      {
        "voice": "qwen-tts-vc-my_clone_01-voice-2025...",
        "gmt_create": "2025-08-11 17:59:32",
        "target_model": "qwen3-tts-vc-2026-01-22"
      }
    ]
  },
  "usage": {
    "count": 0
  },
  "request_id": "yourRequestId"
}
```

### 7.3 Delete voice

Request:

```json
{
  "model": "qwen-voice-enrollment",
  "input": {
    "action": "delete",
    "voice": "qwen-tts-vc-my_clone_01-voice-2025..."
  }
}
```

Response:

```json
{
  "usage": {
    "count": 0
  },
  "request_id": "yourRequestId"
}
```

### 7.4 Cloning audio input constraints

- Format: WAV (16-bit), MP3, M4A
- Duration: recommended 10-20s, max 60s
- File size: < 10 MB
- Sample rate: >= 24 kHz
- Channel: mono
- Content: at least 3s continuous clear speech, no background noise/music/other speakers

## 8. API reference: Voice Design (`qwen-voice-design`)

Endpoint:

- `POST /api/v1/services/audio/tts/customization`

### 8.1 Create voice

Request:

```json
{
  "model": "qwen-voice-design",
  "input": {
    "action": "create",
    "target_model": "qwen3-tts-vd-2026-01-26",
    "voice_prompt": "A calm middle-aged male narrator with clear articulation.",
    "preview_text": "Hello everyone, welcome to today's program.",
    "preferred_name": "my_design_01",
    "language": "en"
  },
  "parameters": {
    "sample_rate": 24000,
    "response_format": "wav"
  }
}
```

Request parameters:

| Field | Required | Type | Notes |
|---|---|---|---|
| `model` | Yes | string | Fixed: `qwen-voice-design` |
| `input.action` | Yes | string | Fixed: `create` |
| `input.target_model` | Yes | string | For this integration: `qwen3-tts-vd-2026-01-26` |
| `input.voice_prompt` | Yes | string | <= 2048 chars; Chinese/English only |
| `input.preview_text` | Yes | string | <= 1024 chars |
| `input.preferred_name` | Yes | string | <= 16 chars, digits/letters/underscore |
| `input.language` | No | string | Defaults to `zh`; must match preview text language |
| `parameters.sample_rate` | No | int | `8000|16000|24000|48000`; default `24000` |
| `parameters.response_format` | No | string | `pcm|wav|mp3|opus`; default `wav` |

Response:

```json
{
  "output": {
    "preview_audio": {
      "data": "<base64_audio>",
      "sample_rate": 24000,
      "response_format": "wav"
    },
    "target_model": "qwen3-tts-vd-2026-01-26",
    "voice": "qwen-tts-vd-my_design_01-voice-2025..."
  },
  "usage": {
    "count": 1
  },
  "request_id": "yourRequestId"
}
```

### 8.2 List voices

Request:

```json
{
  "model": "qwen-voice-design",
  "input": {
    "action": "list",
    "page_size": 10,
    "page_index": 0
  }
}
```

Response:

```json
{
  "output": {
    "page_index": 0,
    "page_size": 10,
    "total_count": 26,
    "voice_list": [
      {
        "gmt_create": "2025-12-10 17:04:54",
        "gmt_modified": "2025-12-10 17:04:54",
        "language": "en",
        "preview_text": "Hello everyone, welcome to today's program.",
        "target_model": "qwen3-tts-vd-2026-01-26",
        "voice": "qwen-tts-vd-my_design_01-voice-2025...",
        "voice_prompt": "A calm middle-aged male narrator with clear articulation."
      }
    ]
  },
  "usage": {},
  "request_id": "yourRequestId"
}
```

### 8.3 Query single voice

Request:

```json
{
  "model": "qwen-voice-design",
  "input": {
    "action": "query",
    "voice": "qwen-tts-vd-my_design_01-voice-2025..."
  }
}
```

Found response:

```json
{
  "output": {
    "gmt_create": "2025-12-10 14:54:09",
    "gmt_modified": "2025-12-10 17:47:48",
    "language": "en",
    "preview_text": "Hello everyone, welcome to today's program.",
    "target_model": "qwen3-tts-vd-2026-01-26",
    "voice": "qwen-tts-vd-my_design_01-voice-2025...",
    "voice_prompt": "A calm middle-aged male narrator with clear articulation."
  },
  "usage": {},
  "request_id": "yourRequestId"
}
```

Not-found response (HTTP 400):

```json
{
  "request_id": "yourRequestId",
  "code": "VoiceNotFound",
  "message": "Voice not found: qwen-tts-vd-..."
}
```

### 8.4 Delete voice

Request:

```json
{
  "model": "qwen-voice-design",
  "input": {
    "action": "delete",
    "voice": "qwen-tts-vd-my_design_01-voice-2025..."
  }
}
```

Response:

```json
{
  "output": {
    "voice": "qwen-tts-vd-my_design_01-voice-2025..."
  },
  "usage": {},
  "request_id": "yourRequestId"
}
```

## 9. API reference: Non-streaming speech synthesis

Endpoint:

- `POST /api/v1/services/aigc/multimodal-generation/generation`

### 9.1 Request structure

VC request:

```json
{
  "model": "qwen3-tts-vc-2026-01-22",
  "input": {
    "text": "How is the weather today?",
    "voice": "qwen-tts-vc-my_clone_01-voice-2025...",
    "language_type": "English"
  }
}
```

VD request:

```json
{
  "model": "qwen3-tts-vd-2026-01-26",
  "input": {
    "text": "How is the weather today?",
    "voice": "qwen-tts-vd-my_design_01-voice-2025...",
    "language_type": "English"
  }
}
```

### 9.2 Request parameters

| Field | Required | Type | Notes |
|---|---|---|---|
| `model` | Yes | string | Must equal the voice's `target_model` |
| `input.text` | Yes | string | Text to synthesize |
| `input.voice` | Yes | string | Custom voice ID from VC/VD creation response |
| `input.language_type` | No | string | Default `Auto`; set explicit language for single-language text |
| `input.instructions` | No | string | Not used for this VC/VD integration |
| `input.optimize_instructions` | No | boolean | Not used for this VC/VD integration |
| `stream` (Python SDK only) | No | boolean | Set `false` for non-streaming output |

`language_type` values:

- `Auto`, `Chinese`, `English`, `German`, `Italian`, `Portuguese`, `Spanish`, `Japanese`, `Korean`, `French`, `Russian`

Input size note from API reference:

- `qwen-tts`: max 512 tokens.
- Other models: max 600 characters.

Inference: treat VC/VD non-realtime requests as max 600 characters until Alibaba documents a model-specific override.

### 9.3 Return object (non-streaming)

```json
{
  "status_code": 200,
  "request_id": "5c63c65c-cad8-4bf4-959d-xxxxxxxxxxxx",
  "code": "",
  "message": "",
  "output": {
    "text": null,
    "finish_reason": "stop",
    "choices": null,
    "audio": {
      "data": "",
      "url": "https://dashscope-result-...wav?...",
      "id": "audio_5c63c65c-cad8-4bf4-959d-xxxxxxxxxxxx",
      "expires_at": 1766113409
    }
  },
  "usage": {
    "input_tokens": 0,
    "output_tokens": 0,
    "characters": 195
  }
}
```

### 9.4 Response fields

| Field | Type | Meaning |
|---|---|---|
| `status_code` | integer | HTTP status |
| `request_id` | string | Request trace ID |
| `code` | string | Error code if failed |
| `message` | string | Error message if failed |
| `output.finish_reason` | string | `stop` on completed output |
| `output.audio.url` | string | Temporary complete audio file URL (24h validity) |
| `output.audio.data` | string | Base64 chunk field used in streaming paths; empty for non-streaming responses |
| `output.audio.id` | string | Audio identifier |
| `output.audio.expires_at` | integer | URL expiry UNIX timestamp |
| `usage` | object | Consumption fields (`characters` and/or token fields) |

## 10. Implementation notes for backend robustness

### 10.1 Recommended persisted fields

For voices table:

- `provider_voice_id`
- `provider_voice_type` (`vc` or `vd`)
- `target_model`
- `preferred_name`
- `provider_request_id`
- `created_at_provider`

For generation tasks:

- `input_text`
- `voice_id` (foreign key)
- `provider_model`
- `provider_request_id`
- `provider_audio_id`
- `provider_audio_url`
- `provider_audio_expires_at`
- `storage_object_path`
- `status` (`submitted|processing|completed|failed`)
- `error_code`
- `error_message`

### 10.2 Validation rules (before provider call)

1. Voice exists and belongs to caller/account.
2. Voice family and model match (`vc` with VC model, `vd` with VD model).
3. Synthesis model equals voice `target_model`.
4. Text length within configured cap.
5. Region/account lane consistency.

### 10.3 Audio URL handling

- Treat vendor URL as ephemeral (24 hours).
- Download immediately after synthesis success.
- Upload to durable storage before final success state.
- Never return only vendor temporary URL as final product artifact.

### 10.4 Retry policy

Recommended:

- Retry transient network/5xx with bounded exponential backoff.
- Do not blind-retry 4xx validation errors.
- Always log `request_id` for support investigation.

Inference: use idempotency keying on your side (task ID + model + voice + text hash) to prevent duplicate billable synthesis calls.

## 11. Example code (non-streaming, updated models)

### 11.1 cURL synthesis (VC)

```bash
curl -X POST 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation' \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen3-tts-vc-2026-01-22",
    "input": {
      "text": "How is the weather today?",
      "voice": "qwen-tts-vc-my_clone_01-voice-2025...",
      "language_type": "English"
    }
  }'
```

### 11.2 cURL synthesis (VD)

```bash
curl -X POST 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation' \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen3-tts-vd-2026-01-26",
    "input": {
      "text": "How is the weather today?",
      "voice": "qwen-tts-vd-my_design_01-voice-2025...",
      "language_type": "English"
    }
  }'
```

### 11.3 Python SDK synthesis (VC)

```python
import os
import dashscope

dashscope.base_http_api_url = "https://dashscope-intl.aliyuncs.com/api/v1"

resp = dashscope.MultiModalConversation.call(
    model="qwen3-tts-vc-2026-01-22",
    api_key=os.getenv("DASHSCOPE_API_KEY"),
    text="How is the weather today?",
    voice="qwen-tts-vc-my_clone_01-voice-2025...",
    language_type="English",
    stream=False,
)
print(resp)
```

### 11.4 Python SDK synthesis (VD)

```python
import os
import dashscope

dashscope.base_http_api_url = "https://dashscope-intl.aliyuncs.com/api/v1"

resp = dashscope.MultiModalConversation.call(
    model="qwen3-tts-vd-2026-01-26",
    api_key=os.getenv("DASHSCOPE_API_KEY"),
    text="How is the weather today?",
    voice="qwen-tts-vd-my_design_01-voice-2025...",
    language_type="English",
    stream=False,
)
print(resp)
```

### 11.5 Java SDK synthesis (VC/VD)

```java
import com.alibaba.dashscope.aigc.multimodalconversation.MultiModalConversation;
import com.alibaba.dashscope.aigc.multimodalconversation.MultiModalConversationParam;
import com.alibaba.dashscope.aigc.multimodalconversation.MultiModalConversationResult;
import com.alibaba.dashscope.exception.ApiException;
import com.alibaba.dashscope.exception.NoApiKeyException;
import com.alibaba.dashscope.exception.UploadFileException;
import com.alibaba.dashscope.utils.Constants;

public class Main {
    private static final String MODEL = "qwen3-tts-vc-2026-01-22"; // or qwen3-tts-vd-2026-01-26
    private static final String VOICE = "qwen-tts-vc-my_clone_01-voice-2025..."; // use matching voice family

    public static void main(String[] args) {
        Constants.baseHttpApiUrl = "https://dashscope-intl.aliyuncs.com/api/v1";
        MultiModalConversation conv = new MultiModalConversation();
        MultiModalConversationParam param = MultiModalConversationParam.builder()
            .apiKey(System.getenv("DASHSCOPE_API_KEY"))
            .model(MODEL)
            .text("How is the weather today?")
            .parameter("voice", VOICE)
            .parameter("language_type", "English")
            .build();

        try {
            MultiModalConversationResult result = conv.call(param);
            System.out.println(result.getOutput().getAudio().getUrl());
        } catch (ApiException | NoApiKeyException | UploadFileException e) {
            System.out.println(e.getMessage());
        }
    }
}
```

## 12. Error handling reference (implementation-oriented)

### 12.1 HTTP status guidance

- `200`: success
- `400`: bad request / validation / not found style errors
- `401`: unauthorized
- `404`: resource not found
- `500`: provider internal error

### 12.2 Known error examples from docs

- `VoiceNotFound` (voice design query/delete not found case)
- `Audio.PreprocessError` (voice cloning may return when `input.text` mismatches audio significantly)

### 12.3 Handling policy

- 4xx errors: mark failed, surface actionable message, do not auto-retry.
- 5xx/network timeouts: retry with backoff and max attempts.
- Persist `request_id`, `code`, `message` on all failures.

## 13. Rate limits, quotas, cleanup

### 13.1 Rate limits (from Qwen TTS model feature table)

- VC model family: RPM 180
- VD model family: RPM 180

### 13.2 Voice quotas and cleanup

- Total custom voices: 1000 per account
- Auto cleanup: voices unused for one year may be deleted

## 14. Pricing (as of February 11, 2026)

### 14.1 Synthesis pricing for target models

| Model | International (Singapore) | Mainland China (Beijing) |
|---|---|---|
| `qwen3-tts-vc-2026-01-22` | USD 0.115 / 10,000 characters | USD 0.115 / 10,000 characters |
| `qwen3-tts-vd-2026-01-26` | USD 0.115 / 10,000 characters | USD 0.115 / 10,000 characters |

### 14.2 Voice creation pricing

| Operation | Price |
|---|---|
| Voice cloning create (`qwen-voice-enrollment`, `action=create`) | USD 0.01 per voice |
| Voice design create (`qwen-voice-design`, `action=create`) | USD 0.20 per voice |

### 14.3 Free quotas noted by vendor docs

- Voice cloning: 1000 free creation attempts within 90 days (Singapore and Beijing lanes noted by vendor docs).
- Voice design: 10 free creations within 90 days (Singapore lane noted by vendor docs).

### 14.4 Billing notes

- Voice creation and synthesis are billed separately.
- Failed voice creations are not billed.
- Deleting voices does not restore used free quota.

Inference: for cost tracking, store provider `usage` payload per request and use it as source of truth for internal analytics.

## 15. Minimal backend implementation checklist

1. Configure region lane and API key.
2. Implement VC create/list/delete APIs.
3. Implement VD create/list/query/delete APIs.
4. Persist `voice` + `target_model` + request metadata.
5. Implement non-streaming synthesis endpoint wrapper.
6. Validate model/voice family match before call.
7. Download and store returned audio URL to durable storage.
8. Persist task state transitions and error metadata.
9. Add retry policy only for transient failures.
10. Add integration tests for VC, VD, model mismatch, and expired URL handling.

## 16. Official references

- Speech synthesis overview: https://www.alibabacloud.com/help/en/model-studio/qwen-tts
- Speech synthesis API reference: https://www.alibabacloud.com/help/en/model-studio/qwen-tts-api
- Voice cloning API reference: https://www.alibabacloud.com/help/en/model-studio/qwen-tts-voice-cloning
- Voice design API reference: https://www.alibabacloud.com/help/en/model-studio/qwen-tts-voice-design