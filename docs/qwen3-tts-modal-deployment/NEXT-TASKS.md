# Qwen3-TTS: Next Implementation Tasks

> **Created**: 2026-01-27
> **Purpose**: Transition document for upcoming implementation tasks
> **Prerequisites**: 1.7B model deployed and tested

This document provides complete context for the three remaining tasks in the Qwen3-TTS implementation.

---

## Task Overview

| Task | Priority | Estimated Effort | Dependencies |
|------|----------|------------------|--------------|
| 1. Deploy 0.6B Model | High | 30 min | None |
| 2. Deploy Voice Design Model | Medium | 1-2 hours | Research needed |
| 3. Utter Backend Integration | High | 2-4 hours | Task 1 (optional) |

---

## Task 1: Deploy 0.6B Model

### Readiness: READY

All infrastructure and patterns are established from the 1.7B deployment.

### Why Deploy 0.6B?

- **Faster inference**: Smaller model generates faster
- **Lower cost**: T4 GPU ($0.59/hr) vs A10G ($1.10/hr)
- **Good quality**: Suitable for draft previews or less demanding use cases
- **Option for users**: Allow quality/speed tradeoff

### What's Different from 1.7B?

| Property | 0.6B | 1.7B |
|----------|------|------|
| Model ID | `Qwen/Qwen3-TTS-12Hz-0.6B-Base` | `Qwen/Qwen3-TTS-12Hz-1.7B-Base` |
| Size | ~1.5 GB | ~4.23 GB |
| VRAM | ~2-3 GB | ~5-6 GB |
| GPU | T4 (16GB) | A10G (24GB) |
| Quality | Good | Best |

### Implementation Steps

```bash
# Step 1: Download 0.6B model to volume
cd modal_app/qwen3_tts
uv run modal run download_models.py --model-size 0.6B 2>&1 | cat

# Step 2: Create 0.6B app variant
# Copy app.py to app_06b.py and modify:
#   MODEL_ID = "Qwen/Qwen3-TTS-12Hz-0.6B-Base"
#   GPU_TYPE = "T4"
#   App name = "qwen3-tts-voice-clone-06b"

# Step 3: Deploy
uv run modal deploy app_06b.py 2>&1 | cat

# Step 4: Test
python test_client.py --endpoint <new-06b-endpoint>
```

### Reference Documentation

- [03-model-caching.md](./03-model-caching.md) - Download commands
- [IMPLEMENTATION-STATUS.md](./IMPLEMENTATION-STATUS.md) - Pain points to avoid
- [config.py](../../modal_app/qwen3_tts/config.py) - GPU configuration

### Expected Outcome

New endpoints at:
- `https://duncab013--qwen3-tts-voice-clone-06b-qwen3ttsservice-clone.modal.run`
- `https://duncab013--qwen3-tts-voice-clone-06b-qwen3ttsservice-health.modal.run`

---

## Task 2: Deploy Voice Design Model

### Readiness: NEEDS RESEARCH

The voice design model uses a different generation method than voice cloning.

### What is Voice Design?

**Voice Cloning** (current): Input reference audio + transcript → Clone that voice
**Voice Design** (new): Input text description → Generate a new voice matching description

Example voice design prompts:
- "A deep, gravelly pirate voice"
- "Cheerful, energetic female voice with British accent"
- "Calm, professional male narrator voice"

### Research Needed

1. **Model availability**: Verify `Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign` exists on HuggingFace
2. **API method**: Confirm method name (`generate_voice_design` or similar)
3. **Parameters**: What parameters does voice design accept?
4. **VRAM requirements**: Can it share GPU with Base model?

### Preliminary Implementation Plan

```python
# In a new endpoint or service:
@modal.method()
def generate_voice_design(
    self,
    text: str,
    voice_description: str,
    language: str = "English",
    max_new_tokens: int = 2048,
) -> bytes:
    """Generate speech with a designed voice."""
    # Use VoiceDesign model's generate method
    wavs, sr = self.design_model.generate_voice_design(
        text=text,
        voice_description=voice_description,
        language=language,
        max_new_tokens=max_new_tokens,
    )
    # Convert to WAV bytes
    ...
```

### Deployment Options

**Option A: Separate App**
- New app: `qwen3-tts-voice-design`
- Isolation from voice cloning
- Independent scaling

**Option B: Combined App** (recommended if VRAM allows)
- Add to existing `qwen3-tts-voice-clone` app
- Load both models in `@modal.enter()`
- Add `/design` endpoint
- Cost efficient (one container)

### Reference Documentation

- [qwen-tts-plan.md](../qwen-tts-plan.md) - Original planning doc with voice design sketch
- [Qwen3-TTS GitHub](https://github.com/QwenLM/Qwen3-TTS) - Official documentation
- [HuggingFace](https://huggingface.co/Qwen) - Model availability

### Action Items Before Implementation

- [ ] Verify VoiceDesign model exists on HuggingFace
- [ ] Read official Qwen3-TTS voice design documentation
- [ ] Test voice design locally (if possible) to understand API
- [ ] Determine VRAM requirements for combined deployment
- [ ] Decide on deployment architecture (separate vs combined)

---

## Task 3: Utter Backend Integration

### Readiness: READY (after schema design decision)

Complete integration guide exists at [08-utter-integration.md](./08-utter-integration.md).

### Key Changes Required

#### 1. Database Schema

**Voice model** - Add 2 columns:
```python
class Voice(Base):
    # Existing
    id: Mapped[str]
    name: Mapped[str]
    reference_path: Mapped[str]
    created_at: Mapped[datetime]

    # NEW for Qwen3-TTS
    reference_transcript: Mapped[Optional[str]]  # Text type
    language: Mapped[str] = "Auto"               # Default Auto-detect
```

**Generation model** - Add 1 column:
```python
class Generation(Base):
    # Existing columns...

    # NEW
    language: Mapped[str] = "Auto"
```

#### 2. New Service File

Create `backend/services/tts_qwen.py`:
```python
async def generate_speech_qwen(
    voice_id: str,
    text: str,
    ref_text: str,
    language: str = "Auto"
) -> str:
    """Generate speech using Qwen3-TTS Modal API."""
    # 1. Get reference audio path
    # 2. Encode to base64
    # 3. Call Modal endpoint
    # 4. Save response WAV
    # 5. Return path
```

#### 3. Provider Router

Update `backend/services/tts.py`:
```python
TTS_PROVIDER = os.getenv("TTS_PROVIDER", "echo")

async def generate_speech(voice_id, text, ref_text=None, language="Auto"):
    if TTS_PROVIDER == "qwen":
        return await generate_speech_qwen(voice_id, text, ref_text, language)
    else:
        return await generate_speech_echo(voice_id, text)
```

#### 4. API Endpoint Changes

**POST /api/clone**:
- Add `transcript` form field (required, min 10 chars)
- Add `language` form field (optional, default "Auto")
- Store in database

**POST /api/generate**:
- Load voice's `reference_transcript` from DB
- Pass to TTS service
- Store language in generation record

#### 5. Frontend Updates

**clone.html**:
- Add transcript textarea
- Add language dropdown
- Client-side validation

### Implementation Order

1. Database migration (add columns)
2. Create `tts_qwen.py` service
3. Update `tts.py` as router
4. Update `/api/clone` endpoint
5. Update `/api/generate` endpoint
6. Update frontend forms
7. Add `GET /api/languages` endpoint
8. Test end-to-end

### Reference Documentation

- [08-utter-integration.md](./08-utter-integration.md) - Complete integration guide
- [backend/models.py](../../backend/models.py) - Current schema
- [backend/main.py](../../backend/main.py) - Current endpoints
- [backend/services/tts.py](../../backend/services/tts.py) - Current TTS service

### Environment Configuration

```bash
# .env file
TTS_PROVIDER=qwen                    # or "echo" for backward compatibility
QWEN_MODAL_ENDPOINT=https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-clone.modal.run
```

---

## Recommended Task Order

1. **Task 1 (0.6B)** - Quick win, establishes multi-model pattern
2. **Task 3 (Integration)** - Enables Utter to use deployed 1.7B
3. **Task 2 (Voice Design)** - Can be added after core integration works

---

## Common Pain Points to Avoid

From [IMPLEMENTATION-STATUS.md](./IMPLEMENTATION-STATUS.md):

| Issue | Solution |
|-------|----------|
| Windows Unicode error | Pipe through `cat`: `uv run modal deploy app.py 2>&1 \| cat` |
| FastAPI import error | Use lazy imports inside methods, not module level |
| Reference URL 403 | Use base64-encoded audio |
| "File name too long" | Decode base64 to temp file before passing to model |
| Container caching | Stop app before redeploy: `uv run modal app stop <app-name>` |

---

## Testing Resources

| Resource | Location |
|----------|----------|
| Reference audio | `test/2026-01-26/audio.wav` |
| Reference transcript | `test/2026-01-26/audio_text.txt` |
| Test script | `test/test_qwen3_tts.py` |
| Test client | `modal_app/qwen3_tts/test_client.py` |

---

## Questions to Resolve

Before starting each task, consider:

### For 0.6B Deployment
- Should 0.6B and 1.7B share the same volume? (Yes, they already do)
- Should they have the same API structure? (Yes, for consistency)

### For Voice Design
- Is VoiceDesign model publicly available?
- What are the input parameters?
- Can it run alongside Base model on same GPU?

### For Integration
- Should we support both Echo-TTS and Qwen3-TTS simultaneously? (Yes, via TTS_PROVIDER)
- How to handle existing voices without transcripts? (Nullable column, require for new)
- Should we auto-migrate existing DB? (Yes, with nullable columns)
