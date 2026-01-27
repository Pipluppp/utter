# Qwen3-TTS Modal Deployment - Implementation Status

> **Last Updated**: 2026-01-28
> **Status**: Fully Deployed and Integrated into Utter

---

## Summary

The Qwen3-TTS 1.7B and 0.6B voice cloning services have been deployed to Modal.com and fully integrated into the Utter web application. This document tracks implementation progress, pain points encountered, and lessons learned.

---

## Deployment Status

| Component | Status | Date | Notes |
|-----------|--------|------|-------|
| Modal CLI Setup | Complete | 2026-01-27 | Using `uv run modal` |
| HuggingFace Secret | Complete | 2026-01-27 | `huggingface-secret` |
| Modal Volume | Complete | 2026-01-27 | `qwen3-tts-models` |
| 1.7B Model Download | Complete | 2026-01-27 | 4.23 GB |
| Tokenizer Download | Complete | 2026-01-27 | 0.64 GB |
| 1.7B Service Deploy | Complete | 2026-01-27 | A10G GPU |
| 1.7B API Testing | Complete | 2026-01-27 | All endpoints working |
| 0.6B Model Download | Complete | 2026-01-28 | 2.34 GB |
| 0.6B Service Deploy | Complete | 2026-01-28 | T4 GPU |
| 0.6B API Testing | Complete | 2026-01-28 | Clone endpoint verified |
| Voice Design Model | Skipped | | Not needed for MVP |
| Utter Integration | Complete | 2026-01-28 | Backend + frontend done |

---

## Live Endpoints (1.7B)

| Endpoint | URL | Method |
|----------|-----|--------|
| Clone | `https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-clone.modal.run` | POST |
| Clone Batch | `https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-clone-batch.modal.run` | POST |
| Health | `https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-health.modal.run` | GET |
| Languages | `https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-languages.modal.run` | GET |

**Modal Dashboard**: https://modal.com/apps/duncab013/main/deployed/qwen3-tts-voice-clone

---

## Live Endpoints (0.6B)

| Endpoint | URL | Method |
|----------|-----|--------|
| Clone | `https://duncab013--qwen3-tts-voice-clone-06b-qwen3ttsservice-clone.modal.run` | POST |
| Health | `https://duncab013--qwen3-tts-voice-clone-06b-qwen3ttsservice-health.modal.run` | GET |
| Languages | `https://duncab013--qwen3-tts-voice-clone-06b-qwen3ttsservice-languages.modal.run` | GET |

**Modal Dashboard**: https://modal.com/apps/duncab013/main/deployed/qwen3-tts-voice-clone-06b

### Model Comparison

| Property | 0.6B | 1.7B |
|----------|------|------|
| GPU | Tesla T4 (16 GB) | A10G (24 GB) |
| Cold start | ~32s | ~90s |
| Attention | SDPA | SDPA |
| Model size on volume | 2.34 GB | 4.23 GB |

---

## Implementation Files

```
modal_app/qwen3_tts/
├── __init__.py               # Package initialization (v1.0.0)
├── app.py                    # 1.7B Modal app (A10G GPU)
├── app_06b.py                # 0.6B Modal app (T4 GPU)
├── config.py                 # Configuration constants
├── download_models.py        # Model download script for Modal volume
└── test_client.py            # API test client (generic, takes --endpoint)

test/
├── test_qwen3_tts.py         # Test script (supports --model 1.7B/0.6B)
├── reference/
│   ├── audio.wav             # Reference audio (multi-sentence)
│   └── audio_text.txt        # Transcript (14 sentences)
└── outputs/
    ├── 1.7B/
    │   └── clone_output.wav  # Generated output from 1.7B model
    └── 0.6B/
        └── clone_output.wav  # Generated output from 0.6B model

backend/                        # Utter integration files (modified/new)
├── .env                        # TTS_PROVIDER=qwen, QWEN_MODAL_ENDPOINT
├── config.py                   # Added TTS_PROVIDER, SUPPORTED_LANGUAGES
├── models.py                   # Added reference_transcript, language columns
├── database.py                 # Added ALTER TABLE auto-migration
├── main.py                     # Updated clone/generate, added /api/languages
├── requirements.txt            # Added httpx>=0.27.0
├── services/
│   ├── tts.py                  # Rewritten as provider router
│   └── tts_qwen.py            # NEW — async Qwen3-TTS Modal client
├── templates/
│   ├── clone.html              # Added transcript textarea + language
│   └── generate.html           # Added language dropdown
└── static/js/
    └── app.js                  # Updated forms for transcript + language
```

---

## Pain Points & Lessons Learned

### 1. FastAPI Import Error on Local Machine

**Problem**: When running `modal deploy app.py`, the local Python environment didn't have FastAPI installed, causing `ModuleNotFoundError: No module named 'fastapi'`.

**Root Cause**: Modal parses the Python file locally before deploying. If you use top-level imports for packages only installed in the container image, it fails.

**Solution**: Use lazy imports inside methods, not at module level:
```python
# BAD - fails on local machine
from fastapi import HTTPException
from pydantic import BaseModel

# GOOD - import inside methods
@modal.fastapi_endpoint(docs=True, method="POST")
def clone(self, request: dict):
    from fastapi import HTTPException
    from fastapi.responses import StreamingResponse
    # ...
```

**Lesson for 0.6B/Voice Design**: Keep top-level imports minimal. Only import `modal` and standard library at module level.

---

### 2. Unicode/UTF-8 Encoding Error on Windows

**Problem**: Running `modal run` or `modal deploy` on Windows failed with:
```
'charmap' codec can't encode character '\u2713' in position 0
```

**Root Cause**: Modal CLI outputs Unicode checkmarks (✓) which Windows cmd.exe can't display by default.

**Solution**: Pipe output through `cat` or set environment variable:
```bash
# Option 1: Pipe through cat
PYTHONIOENCODING=utf-8 uv run modal deploy app.py 2>&1 | cat

# Option 2: Just pipe it
uv run modal deploy app.py 2>&1 | cat
```

**Lesson for 0.6B/Voice Design**: Always use the piped command pattern on Windows.

---

### 3. Reference Audio URL Returns 403 Forbidden

**Problem**: The Qwen sample audio URL from their documentation returns HTTP 403:
```
https://qianwen-res.oss-cn-beijing.aliyuncs.com/Qwen3-TTS-Repo/clone.wav
```

**Root Cause**: The Alibaba Cloud OSS storage may have regional restrictions or require specific headers.

**Solution**: Use base64-encoded audio instead of URLs. Added `_resolve_ref_audio()` method to handle both:
```python
def _resolve_ref_audio(self, ref_audio: str) -> str:
    if ref_audio.startswith(("http://", "https://")):
        return ref_audio  # URL - pass directly

    # Base64 - decode and save to temp file
    audio_bytes = base64.b64decode(ref_audio)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(audio_bytes)
        return f.name
```

**Lesson for 0.6B/Voice Design**: Always support base64 input. Don't rely on external URLs for testing.

---

### 4. "File name too long" Error with Base64

**Problem**: Passing base64 data directly to `model.generate_voice_clone()` caused:
```
[Errno 36] File name too long: 'UklGRsy6BgBXQVZFZm10...'
```

**Root Cause**: The qwen-tts library treats the `ref_audio` parameter as a file path, not raw data. When given a long base64 string, it tries to open it as a filename.

**Solution**: The `_resolve_ref_audio()` method decodes base64 and saves to a temp file before passing to the model. Temp files are cleaned up in a `finally` block.

**Lesson for 0.6B/Voice Design**: The qwen-tts library only accepts URLs or file paths for reference audio, not raw bytes or base64.

---

### 5. Container Caching After Redeployment

**Problem**: After redeploying with code fixes, the old code was still running because Modal containers were cached.

**Solution**: Stop the app before redeploying to force fresh containers:
```bash
uv run modal app stop qwen3-tts-voice-clone
uv run modal deploy app.py
```

Or wait for the 5-minute idle timeout to expire.

**Lesson for 0.6B/Voice Design**: After code changes, explicitly stop the app before redeploying for immediate effect.

---

### 6. Cold Start Time (~90 seconds)

**Problem**: First request after container spindown takes ~90-95 seconds.

**Breakdown**:
- Container provisioning: ~5-10s
- Image layer download: ~10-20s (cached after first deploy)
- Model loading from volume: ~30-60s
- First inference: ~5-10s

**Mitigation**:
- Container idle timeout set to 300s (5 minutes)
- Models pre-cached in volume (avoids ~5-10 minute HuggingFace download)
- Send periodic health checks to keep warm

**Lesson for 0.6B/Voice Design**: Cold start is unavoidable but predictable. Document expected times for users.

---

## Test Reference Files

Located in `test/reference/`:

**audio.wav**: Multi-sentence reference audio for voice cloning

**audio_text.txt** (transcript):
```
Prosecutors have opened a massive investigation into allegations of fixing games and illegal betting.
Different telescope designs perform differently and have different strengths and weaknesses.
We can continue to strengthen the education of good lawyers.
Feedback must be timely and accurate throughout the project.
Humans also judge distance by using the relative sizes of objects.
Churches should not encourage it or make it look harmless.
Learn about setting up wireless network configuration.
You can eat them fresh, cooked or fermented.
If this is true then those who tend to think creatively really are somehow different.
She will likely jump for joy and want to skip straight to the honeymoon.
The sugar syrup should create very fine strands of sugar that drape over the handles.
But really in the grand scheme of things, this information is insignificant.
I let the positive overrule the negative.
He wiped his brow with his forearm.
```

---

## Testing Commands

### Health Check
```bash
curl https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-health.modal.run
```

### Clone with Test Reference (using Python)
```python
import base64
import json
import requests

# Read reference audio
with open('test/reference/audio.wav', 'rb') as f:
    audio_b64 = base64.b64encode(f.read()).decode('utf-8')

# Read transcript
with open('test/reference/audio_text.txt', 'r') as f:
    ref_text = f.read().strip()

# Make request
response = requests.post(
    'https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-clone.modal.run',
    json={
        'text': 'Hello, this is a test of voice cloning.',
        'language': 'English',
        'ref_audio_base64': audio_b64,
        'ref_text': ref_text,
    },
    timeout=120
)

# Save output
with open('output.wav', 'wb') as f:
    f.write(response.content)
```

---

## Configuration Reference

### Model Configuration (config.py)
```python
MODEL_1_7B = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"
MODEL_0_6B = "Qwen/Qwen3-TTS-12Hz-0.6B-Base"
TOKENIZER_ID = "Qwen/Qwen3-TTS-Tokenizer-12Hz"

GPU_CONFIG = {
    "0.6B": "T4",      # 16GB VRAM
    "1.7B": "A10G",    # 24GB VRAM
}

CONTAINER_IDLE_TIMEOUT = 300  # 5 minutes
MAX_CONCURRENT_INPUTS = 10
REQUEST_TIMEOUT = 300  # 5 minutes
```

### Volume Contents
```
/vol/models/
├── Qwen3-TTS-12Hz-1.7B-Base/    # 40 files, 4.23 GB
│   ├── config.json
│   ├── model.safetensors        # 3.68 GB
│   ├── speech_tokenizer/        # 650 MB
│   └── ...
├── Qwen3-TTS-12Hz-0.6B-Base/    # 40 files, 2.34 GB
│   ├── config.json
│   ├── model.safetensors        # 1.74 GB
│   ├── speech_tokenizer/        # 650 MB
│   └── ...
├── Qwen3-TTS-Tokenizer-12Hz/    # 19 files, 0.64 GB
└── huggingface/                 # Cache directory
```

---

## Next Steps

See [NEXT-TASKS.md](./NEXT-TASKS.md) for detailed planning and prompting guidance.

### Task 1: 0.6B Deployment - COMPLETE

Deployed 2026-01-28. T4 GPU, ~32s cold start, same API as 1.7B.

### Task 2: Voice Design Model - SKIPPED

Skipping for now to focus on core Utter integration.

### Task 3: Utter Backend Integration - COMPLETE

Completed 2026-01-28. Full backend and frontend integration of Qwen3-TTS into the Utter web application.

**What was built:**

| Component | File(s) | Description |
|-----------|---------|-------------|
| Config | `backend/config.py`, `backend/.env` | `TTS_PROVIDER`, `QWEN_MODAL_ENDPOINT`, `SUPPORTED_LANGUAGES` |
| DB schema | `backend/models.py`, `backend/database.py` | Added `reference_transcript`, `language` columns + auto-migration |
| Qwen TTS service | `backend/services/tts_qwen.py` (NEW) | Async httpx client, base64 audio, calls Modal endpoint |
| TTS router | `backend/services/tts.py` | Dispatches to Echo or Qwen based on `TTS_PROVIDER` |
| API endpoints | `backend/main.py` | Updated `/api/clone`, `/api/generate`; added `/api/languages` |
| Clone frontend | `backend/templates/clone.html`, `app.js` | Transcript textarea, language dropdown, validation |
| Generate frontend | `backend/templates/generate.html`, `app.js` | Language dropdown, elapsed timer, no chunking |
| Dependencies | `backend/requirements.txt` | Added `httpx>=0.27.0` |

---

## Changelog

### 2026-01-28
- Deployed 0.6B model to Modal (T4 GPU, `app_06b.py`)
- Downloaded 0.6B model to shared volume (2.34 GB)
- Tested 0.6B clone endpoint with local reference audio
- Restructured `test/` directory: `reference/`, `outputs/1.7B/`, `outputs/0.6B/`
- Updated `test_qwen3_tts.py` to support `--model 1.7B/0.6B` flag
- **Utter Backend Integration** (Task 3):
  - Added `TTS_PROVIDER` / `QWEN_MODAL_ENDPOINT` config with `.env` support
  - Added `reference_transcript` and `language` columns to Voice/Generation models
  - Created `backend/services/tts_qwen.py` — async httpx client for Modal endpoint
  - Rewrote `backend/services/tts.py` as provider router (Echo vs Qwen)
  - Updated `/api/clone` to accept transcript + language form fields
  - Updated `/api/generate` to pass ref_text + language to TTS service
  - Added `GET /api/languages` endpoint
  - Updated `clone.html` with transcript textarea + language dropdown
  - Updated `generate.html` with language dropdown
  - Updated `app.js` for new form fields, validation, and elapsed time counter
  - Added `httpx>=0.27.0` to `requirements.txt`
  - Verified app boots cleanly with `uv run uvicorn main:app`

### 2026-01-27
- Initial deployment of 1.7B model
- Added base64 audio support with temp file handling
- Fixed FastAPI import issues for Modal compatibility
- Documented all pain points and solutions
- Created test reference files structure
