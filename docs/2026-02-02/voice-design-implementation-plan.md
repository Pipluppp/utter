# VoiceDesign Model Implementation Plan

> **Date**: 2026-02-02
> **Model**: `Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign`
> **Purpose**: Create new voices from natural language descriptions (no reference audio needed)

---

## Executive Summary

VoiceDesign enables users to **create new voices** by describing them in natural language (e.g., "A deep, authoritative male voice with British accent"). The generated audio clip then becomes a reference for the existing 0.6B-Base model to produce long-form content.

**Integration Flow:**
```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   User describes    │────▶│  VoiceDesign 1.7B   │────▶│  Save as "voice"    │
│   voice in text     │     │  generates preview  │     │  (WAV reference)    │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
                                                                   │
                                                                   ▼
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   Generated speech  │◀────│  0.6B-Base clones   │◀────│  User requests      │
│   (any length)      │     │  the designed voice │     │  long-form TTS      │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

---

## 1. New File: `modal_app/qwen3_tts/app_voice_design.py`

### 1.1 Configuration Changes

| Property | 0.6B-Base (current) | VoiceDesign (new) |
|----------|---------------------|-------------------|
| Model ID | `Qwen/Qwen3-TTS-12Hz-0.6B-Base` | `Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign` |
| App Name | `qwen3-tts-voice-clone-06b` | `qwen3-tts-voice-design` |
| GPU | A10G | A10G |
| Timeout | 900s (15 min) | 300s (5 min) |
| Idle Timeout | 300s (5 min) | 300s (5 min) |
| Max Concurrent | 10 | 10 |

### 1.2 Core Generation Method

```python
@modal.method()
def generate_voice_design(
    self,
    text: str,
    language: str,
    instruct: str,
) -> bytes:
    """Generate speech with a designed voice from text description."""
    import soundfile as sf
    
    wavs, sr = self.model.generate_voice_design(
        text=text,
        language=language,
        instruct=instruct,
    )
    
    buffer = io.BytesIO()
    sf.write(buffer, wavs[0], sr, format="WAV", subtype="PCM_16")
    buffer.seek(0)
    
    return buffer.read()
```

### 1.3 FastAPI Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/design` | POST | Design a voice from text description |
| `/health` | GET | Health check with model info |
| `/languages` | GET | List supported languages |

#### `/design` Endpoint

**Request Schema:**
```json
{
  "text": "Hello, this is a preview of your designed voice.",
  "language": "English",
  "instruct": "A warm, friendly female voice with slight vocal fry"
}
```

**Response:** `audio/wav` binary stream

**Validation:**
- `text`: Required, max 500 characters (short previews only)
- `language`: Required, must be in SUPPORTED_LANGUAGES
- `instruct`: Required, max 500 characters

### 1.4 File Structure

```python
"""
Qwen3-TTS VoiceDesign API on Modal.com (1.7B Model)

Creates new voices from natural language descriptions.
No reference audio required.

Sources:
- Qwen3-TTS GitHub: https://github.com/QwenLM/Qwen3-TTS
- Model: https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign
"""

import io
import modal

# =============================================================================
# Configuration
# =============================================================================

MODEL_ID = "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"
MODEL_NAME = MODEL_ID.split("/")[-1]
MODELS_DIR = "/vol/models"
HF_CACHE_DIR = f"{MODELS_DIR}/huggingface"
GPU_TYPE = "A10G"
CONTAINER_IDLE_TIMEOUT = 300  # 5 minutes
MAX_CONCURRENT_INPUTS = 10
GENERATION_TIMEOUT = 300  # 5 minutes (short previews only)

# ... (same image definition as app_06b.py)
# ... (same volume setup)
# ... (service class with generate_voice_design method)
# ... (FastAPI endpoints: /design, /health, /languages)
```

---

## 2. API Endpoint Design

### 2.1 POST `/design`

**Request:**
```json
{
  "text": "Hello, this is a preview of your designed voice.",
  "language": "English",
  "instruct": "A warm, friendly female voice with slight vocal fry"
}
```

**Response:** WAV audio bytes (same format as `/clone`)

**cURL Example:**
```bash
curl -X POST \
  "https://duncab013--qwen3-tts-voice-design-voicedesignservice-design.modal.run" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, this is a test of the voice design system.",
    "language": "English",
    "instruct": "A deep, authoritative male voice with British accent"
  }' \
  --output designed_voice.wav
```

### 2.2 GET `/health`

**Response:**
```json
{
  "status": "healthy",
  "model": "Qwen3-TTS-12Hz-1.7B-VoiceDesign",
  "gpu": "NVIDIA A10G",
  "attention_implementation": "sdpa",
  "supported_languages": ["Auto", "Chinese", "English", ...]
}
```

### 2.3 GET `/languages`

**Response:**
```json
{
  "languages": ["Auto", "Chinese", "English", "Japanese", ...],
  "default": "English",
  "note": "Specify the language for voice design"
}
```

---

## 3. Deployment Commands

### 3.1 Download Model to Volume

```bash
cd modal_app/qwen3_tts

# Update download_models.py to include VoiceDesign model, then:
uv run modal run download_models.py --model voice-design
```

Or add a dedicated download function:
```python
# In download_models.py
@app.function(...)
def download_voice_design_model():
    from huggingface_hub import snapshot_download
    snapshot_download(
        "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign",
        local_dir="/vol/models/Qwen3-TTS-12Hz-1.7B-VoiceDesign",
    )
```

### 3.2 Deploy Service

```bash
cd modal_app/qwen3_tts

# Deploy VoiceDesign service
uv run modal deploy app_voice_design.py
```

### 3.3 Test Deployment

```bash
# Run local test
uv run modal run app_voice_design.py

# Check health
curl "https://duncab013--qwen3-tts-voice-design-voicedesignservice-health.modal.run"

# Generate preview
curl -X POST \
  "https://duncab013--qwen3-tts-voice-design-voicedesignservice-design.modal.run" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world", "language": "English", "instruct": "A friendly male voice"}' \
  --output test.wav
```

---

## 4. Testing Strategy

### 4.1 Unit Tests (Local)

```python
# test/scripts/test_voice_design.py

def test_voice_design_generation():
    """Test basic voice design generation."""
    response = requests.post(
        VOICE_DESIGN_ENDPOINT,
        json={
            "text": "Hello, this is a test.",
            "language": "English",
            "instruct": "A cheerful young woman",
        }
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/wav"
    assert len(response.content) > 10000  # Non-trivial audio

def test_voice_design_validation():
    """Test input validation."""
    # Missing instruct
    response = requests.post(
        VOICE_DESIGN_ENDPOINT,
        json={"text": "Hello", "language": "English"}
    )
    assert response.status_code == 400

def test_voice_design_languages():
    """Test different languages."""
    for lang in ["English", "Chinese", "Japanese", "French"]:
        response = requests.post(
            VOICE_DESIGN_ENDPOINT,
            json={
                "text": "Test message",
                "language": lang,
                "instruct": "A neutral voice",
            }
        )
        assert response.status_code == 200
```

### 4.2 Integration Tests

```python
def test_voice_design_to_clone_workflow():
    """Test the full workflow: design -> save -> clone."""
    # Step 1: Design a voice
    design_response = requests.post(
        VOICE_DESIGN_ENDPOINT,
        json={
            "text": "This is my designed voice preview.",
            "language": "English",
            "instruct": "A warm, friendly female voice",
        }
    )
    designed_audio = design_response.content
    
    # Step 2: Use as reference for cloning
    clone_response = requests.post(
        CLONE_ENDPOINT,
        json={
            "text": "Now I can say anything with this voice.",
            "language": "English",
            "ref_audio_base64": base64.b64encode(designed_audio).decode(),
            "ref_text": "This is my designed voice preview.",
        }
    )
    assert clone_response.status_code == 200
```

### 4.3 Benchmark Tests

| Metric | Target |
|--------|--------|
| Cold start | < 120s |
| Preview generation (50 chars) | < 15s |
| Preview generation (200 chars) | < 30s |

---

## 5. Backend Integration

### 5.1 Config Changes (`backend/config.py`)

```python
# Add new endpoint configuration
QWEN_MODAL_ENDPOINT_VOICE_DESIGN = os.getenv(
    "QWEN_MODAL_ENDPOINT_VOICE_DESIGN",
    "https://duncab013--qwen3-tts-voice-design-voicedesignservice-design.modal.run"
)
```

### 5.2 New Service Function (`backend/services/tts_qwen.py`)

```python
async def design_voice(
    text: str,
    language: str,
    instruct: str,
) -> bytes:
    """
    Design a new voice from a text description.
    
    Args:
        text: Preview text to speak
        language: Target language
        instruct: Natural language voice description
        
    Returns:
        WAV audio bytes of the designed voice preview
    """
    endpoint = QWEN_MODAL_ENDPOINT_VOICE_DESIGN
    if not endpoint:
        raise ValueError("QWEN_MODAL_ENDPOINT_VOICE_DESIGN not configured")
    
    payload = {
        "text": text,
        "language": language,
        "instruct": instruct,
    }
    
    logger.info(f"Designing voice: {instruct[:50]}...")
    start = time.time()
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(endpoint, json=payload)
    
    elapsed = time.time() - start
    
    if response.status_code != 200:
        detail = response.text[:300]
        logger.error(f"VoiceDesign error ({response.status_code}): {detail}")
        raise ValueError(f"Voice design failed: {detail}")
    
    logger.info(f"Voice designed in {elapsed:.1f}s: {len(response.content)} bytes")
    
    return response.content
```

### 5.3 New API Route (`backend/main.py`)

```python
@app.post("/api/voices/design")
async def design_voice(
    text: str = Form(...),
    language: str = Form("English"),
    instruct: str = Form(...),
    name: str = Form(...),
):
    """
    Design a new voice from a text description.
    
    Creates a voice preview and saves it as a new voice entry.
    """
    # Generate preview audio
    audio_bytes = await tts_qwen.design_voice(
        text=text,
        language=language,
        instruct=instruct,
    )
    
    # Create voice entry in database
    voice_id = str(uuid.uuid4())
    
    # Save audio as reference
    reference_path = REFERENCES_DIR / f"{voice_id}.wav"
    with open(reference_path, "wb") as f:
        f.write(audio_bytes)
    
    # Create voice record
    voice = Voice(
        id=voice_id,
        name=name,
        description=instruct,
        reference_text=text,
        source="designed",  # New source type
    )
    
    # Save to database
    async with get_session() as session:
        session.add(voice)
        await session.commit()
    
    return {
        "id": voice_id,
        "name": name,
        "description": instruct,
        "preview_url": f"/api/voices/{voice_id}/preview",
    }
```

### 5.4 Database Model Update (`backend/models.py`)

Add new `source` field to Voice model if not exists:

```python
class Voice(Base):
    __tablename__ = "voices"
    
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(String)
    reference_text = Column(String)
    source = Column(String, default="uploaded")  # "uploaded" | "designed"
    created_at = Column(DateTime, default=datetime.utcnow)
```

---

## 6. Frontend "Voice Creator" UI

### 6.1 User Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Create New Voice                                    [X]    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Voice Name: [___________________________]                  │
│                                                             │
│  Describe your voice:                                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ A warm, friendly female voice with a slight southern   ││
│  │ accent and a gentle, reassuring tone.                  ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Preview text:                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Hello! I'm so glad you're here. Let me help you with   ││
│  │ anything you need today.                               ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Language: [English ▼]                                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  [▶ Generate Preview]                                  ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Preview:                                                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  ▶ ═══════════════════════════════  0:08 / 0:15       ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  [Cancel]                              [Save Voice]         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 New Template (`backend/templates/design.html`)

Key components:
- Voice description textarea
- Preview text input
- Language selector
- Generate Preview button (calls `/api/voices/design/preview`)
- Audio player for preview
- Save button (calls `/api/voices/design`)

### 6.3 JavaScript Functions

```javascript
// Generate preview (doesn't save)
async function generatePreview() {
    const response = await fetch('/api/voices/design/preview', {
        method: 'POST',
        body: new FormData(document.getElementById('designForm'))
    });
    
    if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        document.getElementById('previewPlayer').src = audioUrl;
    }
}

// Save designed voice
async function saveVoice() {
    const response = await fetch('/api/voices/design', {
        method: 'POST',
        body: new FormData(document.getElementById('designForm'))
    });
    
    if (response.ok) {
        const voice = await response.json();
        window.location.href = `/voices/${voice.id}`;
    }
}
```

---

## 7. Example Voice Descriptions

Good prompts for `instruct` parameter:

| Description | Use Case |
|-------------|----------|
| "A warm, friendly female voice with a slight southern accent" | Customer service |
| "A deep, authoritative male voice with British accent" | Documentary narration |
| "A young, energetic voice with enthusiasm and energy" | Marketing/ads |
| "A calm, soothing voice perfect for meditation" | Wellness apps |
| "A professional newsreader voice, clear and neutral" | News/podcasts |
| "A playful, animated voice for children's content" | Kids' apps |
| "An elderly, wise-sounding voice with gravitas" | Audiobooks |

---

## 8. Implementation Checklist

### Phase 1: Modal Deployment
- [ ] Create `app_voice_design.py` (copy from app_06b.py, modify)
- [ ] Add VoiceDesign model to download_models.py
- [ ] Download model to Modal volume
- [ ] Deploy service
- [ ] Test endpoints manually

### Phase 2: Deployment Verification ⭐ NEW
- [ ] Run `verify_voice_design_deployment.py`
- [ ] Verify health endpoint responds
- [ ] Verify languages endpoint responds
- [ ] Generate all 5 test voice designs
- [ ] Test design → clone integration workflow
- [ ] Review performance metrics in JSON output
- [ ] Listen to generated audio files for quality

### Phase 3: Backend Integration
- [ ] Add endpoint config to `config.py`
- [ ] Add `design_voice()` to `tts_qwen.py`
- [ ] Add API routes to `main.py`
- [ ] Update Voice model if needed

### Phase 4: Frontend
- [ ] Create `design.html` template
- [ ] Add navigation link to design page
- [ ] Add JavaScript for preview/save

### Phase 5: Testing
- [ ] Write test script in `test/scripts/`
- [ ] Test cold start time
- [ ] Test generation quality
- [ ] Test design-to-clone workflow

---

## 9. Cost Estimate

| Component | Cost |
|-----------|------|
| A10G GPU | ~$1.10/hr |
| Model download (one-time) | ~$0.05 |
| Container idle | $0 (shuts down after 5 min) |
| Per preview (warm) | ~$0.02 (assuming 60s) |
| Per preview (cold) | ~$0.10 (assuming 5 min total) |

**Expected usage pattern**: 
- Most previews from warm containers
- ~3 previews per designed voice (iteration)
- Cost per designed voice: ~$0.06-0.15

---

## 10. Documentation Updates

### Files to Update:
1. `docs/qwen3-tts-modal-deployment/README.md` - Add VoiceDesign section
2. `docs/qwen3-tts-modal-deployment/IMPLEMENTATION-STATUS.md` - Update status table
3. `docs/qwen3-tts-models-map.md` - Already has VoiceDesign info (no changes)

### New Section for README.md:

```markdown
### VoiceDesign Model (NEW)

Creates new voices from natural language descriptions. No reference audio needed.

| Endpoint | URL |
|----------|-----|
| Design | `https://duncab013--qwen3-tts-voice-design-voicedesignservice-design.modal.run` |
| Health | `https://duncab013--qwen3-tts-voice-design-voicedesignservice-health.modal.run` |
| Languages | `https://duncab013--qwen3-tts-voice-design-voicedesignservice-languages.modal.run` |

**Example:**
```bash
curl -X POST \
  "https://duncab013--qwen3-tts-voice-design-voicedesignservice-design.modal.run" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello!", "language": "English", "instruct": "A friendly voice"}' \
  --output voice.wav
```
```

---

## Summary

This implementation plan provides a complete roadmap for deploying the VoiceDesign model. The key insight is that VoiceDesign generates **short previews** that become **references** for the faster 0.6B-Base model. This separation keeps costs low while providing powerful voice creation capabilities.

**Next Steps:**
1. Create `app_voice_design.py` ✅
2. Download model to volume
3. Deploy and test
4. Run verification script
5. Integrate into backend
6. Build frontend UI

---

## 11. Deployment Verification Task ⭐ NEW

After deploying the VoiceDesign model, run the verification script to confirm everything works.

### 11.1 Verification Script

**File:** `test/scripts/verify_voice_design_deployment.py`

**What it does:**
1. Checks health endpoint (warms up container)
2. Verifies languages endpoint
3. Generates 5 different voice designs with performance tracking
4. Tests design → clone integration workflow
5. Saves all audio outputs
6. Produces JSON metrics report

### 11.2 Running Verification

```bash
# After deploying
cd modal_app/qwen3_tts
uv run modal deploy app_voice_design.py

# Run verification (from project root)
cd ../..
python test/scripts/verify_voice_design_deployment.py
```

### 11.3 Test Voice Prompts

| ID | Description | Voice Instruct |
|----|-------------|----------------|
| `friendly_female` | Warm friendly female | "A warm, friendly female voice with a gentle, reassuring tone" |
| `authoritative_male` | News anchor male | "A deep, authoritative male voice like a professional news anchor" |
| `energetic_young` | Energetic YouTuber | "A cheerful, energetic young voice with enthusiasm" |
| `calm_meditation` | Meditation guide | "A calm, soothing voice perfect for meditation and relaxation" |
| `british_narrator` | British narrator | "A refined British male voice with gravitas, like a documentary narrator" |

### 11.4 Expected Output Structure

```
test/outputs/voice-design-verification/
├── friendly_female.wav
├── authoritative_male.wav
├── energetic_young.wav
├── calm_meditation.wav
├── british_narrator.wav
└── design_to_clone_integration.wav

test/results/
└── voice_design_verification_YYYYMMDD_HHMMSS.json
```

### 11.5 Performance Metrics Tracked

The JSON output includes:

```json
{
  "timestamp": "20260202_143022",
  "endpoints": {
    "design": "https://...",
    "health": "https://...",
    "languages": "https://...",
    "clone": "https://..."
  },
  "health": {
    "success": true,
    "latency_ms": 1234,
    "response": { "model": "...", "gpu": "..." }
  },
  "voice_designs": [
    {
      "id": "friendly_female",
      "description": "Warm friendly female",
      "success": true,
      "latency_ms": 15432,
      "audio_size_bytes": 245678,
      "output_file": "test/outputs/voice-design-verification/friendly_female.wav"
    }
  ],
  "integration": {
    "success": true,
    "design_latency_ms": 15432,
    "clone_latency_ms": 12345,
    "total_latency_ms": 27777
  },
  "summary": {
    "total_tests": 8,
    "passed": 8,
    "failed": 0,
    "cold_start_latency_ms": null,
    "avg_warm_latency_ms": 14500,
    "total_audio_bytes": 1234567
  }
}
```

### 11.6 Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Health check | < 120s | Includes cold start |
| Cold start | < 120s | First generation after container scales |
| Warm generation | < 30s | Subsequent generations |
| Design → Clone total | < 60s | Full workflow |
| Audio output | > 50KB | Non-trivial audio |

### 11.7 Verification Success Criteria

✅ **PASS** if:
- All endpoints respond (health, languages, design)
- All 5 voice designs generate successfully
- All audio files are saved and > 50KB
- Design → Clone integration works
- Performance within targets

❌ **FAIL** if:
- Any endpoint returns error
- Any generation times out (> 180s)
- Audio files are empty or corrupted
- Integration workflow breaks
