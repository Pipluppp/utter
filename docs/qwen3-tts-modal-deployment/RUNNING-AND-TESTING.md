# Utter: Running, Testing & Inspecting Guide

> **Last Updated**: 2026-01-28

---

## Running the Backend

```bash
cd C:\Users\Duncan\Desktop\utter\backend

# Install deps (if not done)
uv pip install -r requirements.txt

# Start the dev server
uv run uvicorn main:app --reload
```

Then open:
- **App**: http://localhost:8000
- **Swagger API docs**: http://localhost:8000/docs
- **Clone page**: http://localhost:8000/clone
- **Generate page**: http://localhost:8000/generate

### Mock Mode (no Modal needed)

Set in `.env` to skip real TTS calls (copies reference audio as output):
```
TTS_MOCK=true
```

### Switch TTS Provider

In `backend/.env`:
```bash
TTS_PROVIDER=qwen    # Uses Qwen3-TTS via Modal
TTS_PROVIDER=echo    # Uses Echo-TTS via Modal
```

---

## Testing Qwen3-TTS Modal Endpoints

### Health Checks

```bash
# 1.7B
curl https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-health.modal.run

# 0.6B
curl https://duncab013--qwen3-tts-voice-clone-06b-qwen3ttsservice-health.modal.run
```

### Test Script (generates audio from your reference voice)

```bash
cd C:\Users\Duncan\Desktop\utter\test

# Test 1.7B (default)
uv run --with requests python test_qwen3_tts.py

# Test 0.6B
uv run --with requests python test_qwen3_tts.py --model 0.6B

# Custom text
uv run --with requests python test_qwen3_tts.py --text "Hello world"

# Skip health check (go straight to clone)
uv run --with requests python test_qwen3_tts.py --skip-health
```

Reference files used by the test: `test/reference/audio.wav` and `test/reference/audio_text.txt`. Outputs go to `test/outputs/1.7B/` or `test/outputs/0.6B/`.

### Modal Test Client (lower-level)

```bash
cd C:\Users\Duncan\Desktop\utter\modal_app\qwen3_tts

python test_client.py --endpoint https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-clone.modal.run
```

---

## Modal Deployment

```bash
cd C:\Users\Duncan\Desktop\utter\modal_app\qwen3_tts

# Deploy 1.7B (A10G GPU)
uv run modal deploy app.py 2>&1 | cat

# Deploy 0.6B (T4 GPU)
uv run modal deploy app_06b.py 2>&1 | cat

# Download/manage models on the volume
uv run modal run download_models.py --list-only
uv run modal run download_models.py --model-size 0.6B

# Force fresh containers after code changes
uv run modal app stop qwen3-tts-voice-clone
uv run modal deploy app.py 2>&1 | cat
```

The `2>&1 | cat` avoids the Windows Unicode encoding error with Modal's checkmark characters.

---

## Inspecting the Database

```bash
sqlite3 C:\Users\Duncan\Desktop\utter\backend\utter.db

# Inside sqlite3:
.tables
SELECT id, name, language, created_at FROM voices;
SELECT id, voice_id, text, language, duration_seconds FROM generations ORDER BY created_at DESC LIMIT 10;
```

---

## API Endpoints (curl examples)

```bash
# List voices
curl http://localhost:8000/api/voices

# List supported languages
curl http://localhost:8000/api/languages

# Generate speech
curl -X POST http://localhost:8000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"voice_id": "UUID_HERE", "text": "Hello world", "language": "English"}'

# List generation history
curl http://localhost:8000/api/generations
```

---

## Live Endpoints

### 1.7B Model (A10G GPU)

| Endpoint | URL |
|----------|-----|
| Clone | `https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-clone.modal.run` |
| Health | `https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-health.modal.run` |
| Languages | `https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-languages.modal.run` |
| Batch | `https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-clone-batch.modal.run` |

### 0.6B Model (T4 GPU)

| Endpoint | URL |
|----------|-----|
| Clone | `https://duncab013--qwen3-tts-voice-clone-06b-qwen3ttsservice-clone.modal.run` |
| Health | `https://duncab013--qwen3-tts-voice-clone-06b-qwen3ttsservice-health.modal.run` |
| Languages | `https://duncab013--qwen3-tts-voice-clone-06b-qwen3ttsservice-languages.modal.run` |

---

## Key Files

| Purpose | File |
|---------|------|
| App entry point | `backend/main.py` |
| Config / env vars | `backend/config.py`, `backend/.env` |
| DB models | `backend/models.py` |
| TTS router | `backend/services/tts.py` |
| Qwen client | `backend/services/tts_qwen.py` |
| Frontend JS | `backend/static/js/app.js` |
| Modal 1.7B app | `modal_app/qwen3_tts/app.py` |
| Modal 0.6B app | `modal_app/qwen3_tts/app_06b.py` |
| Test script | `test/test_qwen3_tts.py` |
