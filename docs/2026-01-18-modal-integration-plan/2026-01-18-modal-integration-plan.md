# Echo-TTS + Modal.com Integration Plan

> **Date**: 2026-01-18  
> **Goal**: Replace mock TTS with real GPU-powered voice cloning using Echo-TTS on Modal.com

---

## Overview

This document provides the complete workflow to integrate **Echo-TTS** (a 2.4B parameter voice cloning model) with **Modal.com** (serverless GPU infrastructure) to enable real voice cloning in our Utter app.

### Current State
- ✅ FastAPI backend running
- ✅ Clone page uploads audio files
- ✅ Generate page has text input + audio player
- ⚠️ TTS is mocked (copies reference audio)

### Target State
- ✅ Real voice cloning via Echo-TTS
- ✅ GPU inference on Modal.com (no local GPU needed)
- ✅ ~2-5 second generation time

---

## Part 1: Understanding Echo-TTS

### What is Echo-TTS?

Echo-TTS is a **zero-shot voice cloning** model that:
1. Takes a **reference audio** (10s-5min of someone speaking)
2. Takes **text** you want spoken
3. Generates **new audio** in that person's voice

### Model Specifications

| Spec | Value |
|------|-------|
| Model Size | 2.4B parameters |
| Architecture | Diffusion Transformer (DiT) |
| Audio Codec | Fish-Speech S1-DAC |
| Output Quality | 44.1 kHz |
| Inference Speed | ~1.45s for 30s audio (A100) |
| Recommended VRAM | 16-24GB |
| Minimum VRAM | 8GB (with adjustments) |

### Key Constraints

| Constraint | Limit |
|-----------|-------|
| Max output duration | **30 seconds** |
| Max reference audio | **5 minutes** |
| Max text length | ~768 UTF-8 bytes |
| Sample rate | 44.1 kHz |

### How It Works (Simplified)

```
Reference Audio    Text Prompt
      ↓                 ↓
┌─────┴─────────────────┴─────┐
│         Echo-TTS            │
│   (Diffusion Transformer)   │
│                             │
│  1. Encode reference audio  │
│  2. Encode text prompt      │
│  3. Diffusion sampling      │
│  4. Decode to waveform      │
└─────────────┬───────────────┘
              ↓
       Generated Audio
       (speaker's voice)
```

### Generation Parameters

| Parameter | Default | Effect |
|-----------|---------|--------|
| `num_steps` | 40 | Diffusion steps (more = better quality, slower) |
| `cfg_scale_text` | 3.0 | How closely to follow text |
| `cfg_scale_speaker` | 8.0 | How closely to match speaker voice |
| `sequence_length` | 640 | Latent length (~30s max output) |

### License Warning

> **Non-Commercial Use Only**: Echo-TTS uses Fish-Speech S1-DAC which is licensed CC BY-NC-SA 4.0. Commercial use requires licensing alternative components.

---

## Part 2: Understanding Modal.com

### What is Modal?

Modal is a **serverless GPU platform** that:
- Runs your code in containers with GPUs
- Scales automatically (0 → N containers)
- Charges per second of usage
- Requires **no infrastructure setup** (no Docker, no Kubernetes)

### Why Modal for Echo-TTS?

| Benefit | Details |
|---------|---------|
| **No local GPU needed** | Code runs on Modal's cloud GPUs |
| **Free credits** | $30 free tier for testing |
| **Fast cold starts** | Containers start in <1 second |
| **Pay per use** | Only charged when generating |
| **GPU options** | A10G (24GB), A100 (40GB/80GB), H100 |

### Modal Pricing (Relevant GPUs)

| GPU | VRAM | Price/hour |
|-----|------|------------|
| T4 | 16GB | ~$0.60 |
| A10G | 24GB | ~$1.10 |
| A100-40GB | 40GB | ~$3.00 |

For Echo-TTS, **A10G ($1.10/hr)** is ideal - enough VRAM at low cost.

### How Modal Works

```python
import modal

# 1. Define your app
app = modal.App("my-app")

# 2. Define container image with dependencies
image = modal.Image.debian_slim().pip_install("torch", "transformers")

# 3. Define a function that runs on GPU
@app.function(gpu="A10G", image=image)
def my_gpu_function(input_data):
    # This code runs on Modal's cloud GPU
    return result
```

When you call `my_gpu_function()`:
1. Modal spins up a container with your image
2. Attaches the requested GPU
3. Runs your code
4. Returns the result
5. Container idles or shuts down

---

## Part 3: Integration Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     USER BROWSER                            │
│                                                             │
│  /clone                          /generate                  │
│  ├─ Upload audio                 ├─ Select voice            │
│  └─ POST /api/clone              ├─ Enter text              │
│       ↓                          └─ POST /api/generate      │
└───────┼───────────────────────────────────┼─────────────────┘
        │                                   │
        ▼                                   ▼
┌─────────────────────────────────────────────────────────────┐
│                  FASTAPI BACKEND                            │
│                                                             │
│  /api/clone                      /api/generate              │
│  ├─ Save audio to storage        ├─ Get voice reference     │
│  └─ Save voice to DB             ├─ Call Modal GPU ────────────┐
│                                  └─ Return audio URL        │  │
└─────────────────────────────────────────────────────────────┘  │
                                                                 │
                                                                 ▼
┌─────────────────────────────────────────────────────────────┐
│                     MODAL.COM                               │
│                                                             │
│  EchoTTS Class (GPU Container)                              │
│  ├─ Load model on startup (@modal.enter)                    │
│  ├─ generate(text, audio_bytes) → audio_bytes               │
│  └─ Container idles after 5 min                             │
└─────────────────────────────────────────────────────────────┘
```

### File Changes Required

| File | Action | Purpose |
|------|--------|---------|
| `modal_app/echo_tts.py` | NEW | Modal deployment with Echo-TTS |
| `modal_app/requirements.txt` | NEW | Dependencies for Modal container |
| `backend/services/tts.py` | MODIFY | Call Modal instead of mocking |
| `backend/requirements.txt` | MODIFY | Add `modal` client library |

---

## Part 4: Step-by-Step Implementation

### Step 1: Install Modal CLI

```bash
# Install Modal
pip install modal

# Authenticate (opens browser)
modal setup

# Verify installation
modal --version
```

### Step 2: Create Modal App Directory

```
utter/
├── backend/
└── modal_app/           # NEW
    ├── echo_tts.py      # Modal deployment
    └── requirements.txt # Dependencies
```

### Step 3: Write Modal Deployment

**File: `modal_app/echo_tts.py`**

```python
"""
Echo-TTS deployment on Modal.com

Provides GPU-accelerated voice cloning.
"""
import modal
import io

# Define the Modal app
app = modal.App("utter-tts")

# Define the container image with all dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "ffmpeg")
    .pip_install(
        "torch==2.1.0",
        "torchaudio==2.1.0",
        "transformers",
        "scipy",
        "huggingface_hub",
    )
    .run_commands(
        "pip install git+https://github.com/jordandare/echo-tts.git"
    )
)


@app.cls(
    gpu="A10G",                    # 24GB VRAM
    image=image,
    container_idle_timeout=300,   # Keep warm for 5 min
    timeout=120,                   # 2 min max per request
)
class EchoTTS:
    """Echo-TTS voice cloning service."""
    
    @modal.enter()
    def load_model(self):
        """Load model once when container starts."""
        from inference import (
            load_model_from_hf,
            load_fish_ae_from_hf,
            load_pca_state_from_hf,
        )
        
        print("Loading Echo-TTS models...")
        self.model = load_model_from_hf(delete_blockwise_modules=True)
        self.fish_ae = load_fish_ae_from_hf()
        self.pca_state = load_pca_state_from_hf()
        print("Models loaded!")
    
    @modal.method()
    def generate(self, text: str, reference_audio_bytes: bytes) -> bytes:
        """
        Generate speech from text using a reference voice.
        
        Args:
            text: Text to speak (max ~500 chars)
            reference_audio_bytes: WAV/MP3 file bytes
            
        Returns:
            Generated audio as WAV bytes
        """
        import torch
        import torchaudio
        from functools import partial
        from inference import (
            load_audio_from_bytes,
            sample_pipeline,
            sample_euler_cfg_independent_guidances,
        )
        
        # Load reference audio
        speaker_audio = load_audio_from_bytes(reference_audio_bytes).cuda()
        
        # Configure sampler
        sample_fn = partial(
            sample_euler_cfg_independent_guidances,
            num_steps=40,
            cfg_scale_text=3.0,
            cfg_scale_speaker=8.0,
            sequence_length=640,
        )
        
        # Generate
        audio_out, _ = sample_pipeline(
            model=self.model,
            fish_ae=self.fish_ae,
            pca_state=self.pca_state,
            sample_fn=sample_fn,
            text_prompt=f"[S1] {text}",
            speaker_audio=speaker_audio,
            rng_seed=0,
        )
        
        # Convert to bytes
        buffer = io.BytesIO()
        torchaudio.save(buffer, audio_out[0].cpu(), 44100, format="wav")
        buffer.seek(0)
        
        return buffer.read()


# Test function for local debugging
@app.local_entrypoint()
def test():
    """Test the TTS service."""
    tts = EchoTTS()
    
    # Read a test audio file
    with open("test_reference.wav", "rb") as f:
        audio_bytes = f.read()
    
    result = tts.generate.remote(
        text="Hello, this is a test of the voice cloning system.",
        reference_audio_bytes=audio_bytes
    )
    
    with open("test_output.wav", "wb") as f:
        f.write(result)
    
    print("Generated test_output.wav")
```

### Step 4: Deploy to Modal

```bash
cd modal_app

# Deploy (creates the endpoint)
modal deploy echo_tts.py

# Output will show:
# ✓ Created app: utter-tts
# ✓ Created EchoTTS class
```

### Step 5: Test Modal Deployment

```bash
# Run the test function
modal run echo_tts.py

# Or test via Python
python -c "
import modal
EchoTTS = modal.Cls.lookup('utter-tts', 'EchoTTS')
tts = EchoTTS()
# ... test code
"
```

### Step 6: Update Backend TTS Service

**File: `backend/services/tts.py`**

```python
"""
TTS service using Modal.com for GPU inference.
"""
import modal
from pathlib import Path
import uuid

from config import GENERATED_DIR


# Get reference to Modal class
EchoTTS = modal.Cls.lookup("utter-tts", "EchoTTS")


async def generate_speech(voice_id: str, text: str) -> str:
    """
    Generate speech using Echo-TTS on Modal.com
    
    Args:
        voice_id: UUID of the cloned voice
        text: Text to convert to speech
        
    Returns:
        Path to the generated audio file
    """
    from services.storage import get_reference_path
    
    # Get reference audio
    reference_path = get_reference_path(voice_id)
    if reference_path is None:
        raise ValueError(f"Voice reference not found: {voice_id}")
    
    # Read reference audio bytes
    with open(reference_path, "rb") as f:
        reference_bytes = f.read()
    
    # Call Modal GPU endpoint
    tts = EchoTTS()
    audio_bytes = tts.generate.remote(
        text=text,
        reference_audio_bytes=reference_bytes
    )
    
    # Save to generated directory
    generation_id = str(uuid.uuid4())
    output_path = GENERATED_DIR / f"{generation_id}.wav"
    
    with open(output_path, "wb") as f:
        f.write(audio_bytes)
    
    return str(output_path)
```

### Step 7: Update Backend Requirements

**File: `backend/requirements.txt`** (add):

```
modal>=0.60.0
```

### Step 8: Verify End-to-End

```bash
# 1. Make sure Modal is deployed
modal app list  # Should show "utter-tts"

# 2. Start backend
cd backend
uvicorn main:app --reload

# 3. Test in browser
# - Go to /clone, upload audio
# - Go to /generate, enter text, click Generate
# - Audio should play with cloned voice!
```

---

## Part 5: Cost Estimates

### Development Testing

| Item | Cost |
|------|------|
| Modal free tier | $30 credit |
| A10G cost | ~$1.10/hr |
| Avg generation | ~3 seconds |
| Generations per $1 | ~1,000 |
| **Free tier generations** | **~27,000** |

### Production (Low Volume)

| Scenario | Monthly Cost |
|----------|-------------|
| 100 generations/day | ~$3-5 |
| 1,000 generations/day | ~$30-50 |
| 10,000 generations/day | ~$300-500 |

---

## Part 6: Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "Modal not authenticated" | Run `modal setup` again |
| "GPU not available" | Try different GPU type (T4, A100) |
| "Container OOM" | Use A100 instead of A10G |
| "Timeout error" | Increase `timeout` parameter |
| "Cold start slow" | First request takes ~30s to load model |

### Debugging Commands

```bash
# View Modal logs
modal app logs utter-tts

# Check app status
modal app list

# Stop app
modal app stop utter-tts

# Redeploy after changes
modal deploy echo_tts.py
```

---

## Part 7: Checklist

### Setup
- [ ] Create Modal account at modal.com
- [ ] Install Modal CLI: `pip install modal`
- [ ] Authenticate: `modal setup`

### Development
- [ ] Create `modal_app/echo_tts.py`
- [ ] Deploy to Modal: `modal deploy echo_tts.py`
- [ ] Test deployment: `modal run echo_tts.py`

### Integration
- [ ] Add `modal` to backend requirements
- [ ] Update `services/tts.py` to call Modal
- [ ] Test end-to-end in browser

### Verification
- [ ] Clone page uploads audio successfully
- [ ] Generate page shows voices in dropdown
- [ ] Generate button calls Modal
- [ ] Audio plays with cloned voice
- [ ] Download button works

---

## Part 8: Helper Infrastructure (Critical)

> **Your concern is valid**: Just connecting to Modal is not enough. We need helper logic to ensure user inputs automatically fit Echo-TTS constraints.

### Gap Analysis

| User Provides | Echo-TTS Requires | Gap to Bridge |
|---------------|-------------------|---------------|
| Audio file (any duration) | 10s-5min reference | Duration validation |
| Audio file (WAV/MP3/M4A) | Audio tensor on GPU | Format conversion |
| Text (up to 500 chars) | ~768 UTF-8 bytes max | Byte-length validation |
| Free-form text | Specific punctuation | Text preprocessing |
| Long text (could be >30s) | Max 30s output | Text chunking (future) |

---

### 8.1 Audio Input Processing

#### What Echo-TTS Needs
```
Reference audio requirements:
- Duration: 10 seconds to 5 minutes (enforced by us, not model)
- Format: Waveform tensor loadable by torchaudio
- Quality: Clean speech, minimal background noise
- Sample rate: Any (model resamples internally)
```

#### Helper: Audio Duration Validation

**File: `backend/services/audio.py`** (NEW)

```python
"""Audio processing helpers for Echo-TTS compatibility."""

import io
from pathlib import Path

# Using mutagen for duration detection (lightweight, no ffmpeg needed)
from mutagen import File as MutagenFile
from mutagen.mp3 import MP3
from mutagen.wave import WAVE
from mutagen.mp4 import MP4


def get_audio_duration(file_path: str | Path) -> float:
    """
    Get duration of audio file in seconds.
    
    Supports: WAV, MP3, M4A
    Returns: Duration in seconds
    Raises: ValueError if format not supported
    """
    path = Path(file_path)
    ext = path.suffix.lower()
    
    try:
        if ext == ".wav":
            audio = WAVE(path)
        elif ext == ".mp3":
            audio = MP3(path)
        elif ext == ".m4a":
            audio = MP4(path)
        else:
            raise ValueError(f"Unsupported format: {ext}")
        
        return audio.info.length
    except Exception as e:
        raise ValueError(f"Could not read audio file: {e}")


def validate_reference_audio(file_path: str | Path) -> dict:
    """
    Validate audio file meets Echo-TTS reference requirements.
    
    Returns: {"valid": True, "duration": 45.2, "message": "OK"}
             {"valid": False, "duration": 5.0, "message": "Audio must be..."}
    """
    MIN_DURATION = 10   # seconds
    MAX_DURATION = 300  # 5 minutes
    
    try:
        duration = get_audio_duration(file_path)
        
        if duration < MIN_DURATION:
            return {
                "valid": False,
                "duration": duration,
                "message": f"Audio must be at least {MIN_DURATION} seconds (got {duration:.1f}s)"
            }
        
        if duration > MAX_DURATION:
            return {
                "valid": False,
                "duration": duration,
                "message": f"Audio cannot exceed {MAX_DURATION // 60} minutes (got {duration / 60:.1f}min)"
            }
        
        return {
            "valid": True,
            "duration": duration,
            "message": "OK"
        }
        
    except ValueError as e:
        return {
            "valid": False,
            "duration": 0,
            "message": str(e)
        }
```

#### Integration Point

**Update `POST /api/clone` to validate duration:**

```python
# In main.py, after saving the file:
from services.audio import validate_reference_audio

# Validate audio duration
validation = validate_reference_audio(reference_path)
if not validation["valid"]:
    # Delete the saved file
    os.remove(reference_path)
    raise HTTPException(status_code=400, detail=validation["message"])
```

#### New Dependency

**Add to `backend/requirements.txt`:**
```
mutagen>=1.47.0
```

---

### 8.2 Text Input Processing

#### What Echo-TTS Needs

From `echo-tts-model.md`:
```
Text constraints:
- Max ~768 UTF-8 bytes (not chars!)
- Punctuation affects delivery:
  - Comma → pause
  - Period → pause + falling intonation
  - Question mark → rising intonation
  - Colons, semicolons, emdashes → converted to commas
- Speaker tag [S1] auto-prepended
```

#### Gap: Our MVP allows 500 chars, but model limit is ~768 bytes

UTF-8 encoding means:
- ASCII: 1 byte per char → 500 chars = 500 bytes ✅
- Emoji/special: 2-4 bytes per char → 500 chars could be 2000 bytes ❌

#### Helper: Text Preprocessing

**File: `backend/services/text.py`** (NEW)

```python
"""Text processing helpers for Echo-TTS compatibility."""

import re


# Echo-TTS byte limit (from model docs)
MAX_TEXT_BYTES = 768

# Our app's character limit (user-facing)
MAX_TEXT_CHARS = 500


def preprocess_text(text: str) -> str:
    """
    Preprocess text for optimal Echo-TTS generation.
    
    - Normalizes punctuation (colons, semicolons, emdashes → commas)
    - Strips excessive punctuation
    - Ensures proper sentence endings
    - Adds [S1] speaker tag if not present
    """
    # Strip and normalize whitespace
    text = " ".join(text.split())
    
    # Normalize punctuation that Echo-TTS converts anyway
    text = text.replace(";", ",")
    text = text.replace(":", ",")
    text = text.replace("—", ",")  # emdash
    text = text.replace("--", ",")  # double dash
    
    # Reduce excessive punctuation (e.g., "!!!" → "!")
    text = re.sub(r'!+', '!', text)
    text = re.sub(r'\?+', '?', text)
    text = re.sub(r'\.+', '.', text)
    text = re.sub(r',+', ',', text)
    
    # Ensure text ends with sentence-ending punctuation
    if text and text[-1] not in ".!?":
        text += "."
    
    # Add speaker tag if not present
    if not text.startswith("[S"):
        text = f"[S1] {text}"
    
    return text


def validate_text(text: str) -> dict:
    """
    Validate text meets Echo-TTS constraints.
    
    Returns: {"valid": True, "chars": 150, "bytes": 152, "message": "OK"}
             {"valid": False, "chars": 600, "bytes": 1200, "message": "Text too long"}
    """
    # Strip for validation
    text = text.strip()
    
    if not text:
        return {
            "valid": False,
            "chars": 0,
            "bytes": 0,
            "message": "Please enter text to speak"
        }
    
    char_count = len(text)
    byte_count = len(text.encode("utf-8"))
    
    # Check character limit (user-facing)
    if char_count > MAX_TEXT_CHARS:
        return {
            "valid": False,
            "chars": char_count,
            "bytes": byte_count,
            "message": f"Text cannot exceed {MAX_TEXT_CHARS} characters"
        }
    
    # Check byte limit (Echo-TTS constraint)
    # Account for [S1] prefix we'll add (5 bytes)
    effective_bytes = byte_count + 5
    if effective_bytes > MAX_TEXT_BYTES:
        return {
            "valid": False,
            "chars": char_count,
            "bytes": byte_count,
            "message": f"Text contains too many special characters. Please simplify."
        }
    
    return {
        "valid": True,
        "chars": char_count,
        "bytes": byte_count,
        "message": "OK"
    }


def estimate_duration(text: str) -> float:
    """
    Estimate speech duration for given text.
    
    Rule of thumb: ~150 words per minute, ~5 chars per word
    Returns: Estimated duration in seconds
    """
    word_count = len(text.split())
    # Average speaking rate: 150 words per minute = 2.5 words per second
    return word_count / 2.5
```

#### Integration Point

**Update `POST /api/generate`:**

```python
from services.text import validate_text, preprocess_text

# Validate text
validation = validate_text(text)
if not validation["valid"]:
    raise HTTPException(status_code=400, detail=validation["message"])

# Preprocess for Echo-TTS
processed_text = preprocess_text(text)

# Call Modal with processed text
audio_bytes = tts.generate.remote(
    text=processed_text,  # Now properly formatted
    reference_audio_bytes=reference_bytes
)
```

---

### 8.3 Audio Output Processing

#### What Echo-TTS Produces
```
Output:
- WAV format, 44.1 kHz
- Up to 30 seconds duration
- May have trailing silence (model pads short text)
```

#### What Users Expect
```
- Downloadable MP3 (smaller file size)
- Clean audio without excessive silence
```

#### Helper: Audio Output Processing (Optional Enhancement)

**Add to `backend/services/audio.py`:**

```python
def trim_silence(audio_bytes: bytes, threshold_db: float = -40) -> bytes:
    """
    Trim trailing silence from audio.
    
    Optional enhancement - can skip for MVP.
    """
    # Requires pydub + ffmpeg
    # Implementation omitted for MVP simplicity
    pass


def convert_to_mp3(wav_bytes: bytes) -> bytes:
    """
    Convert WAV to MP3 for smaller download size.
    
    Requires: ffmpeg installed on system
    """
    import subprocess
    import tempfile
    
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as wav_file:
        wav_file.write(wav_bytes)
        wav_path = wav_file.name
    
    mp3_path = wav_path.replace(".wav", ".mp3")
    
    # Use ffmpeg for conversion
    subprocess.run([
        "ffmpeg", "-y", "-i", wav_path,
        "-acodec", "libmp3lame", "-b:a", "192k",
        mp3_path
    ], capture_output=True)
    
    with open(mp3_path, "rb") as f:
        mp3_bytes = f.read()
    
    # Cleanup temp files
    os.remove(wav_path)
    os.remove(mp3_path)
    
    return mp3_bytes
```

**Note:** For MVP, we can skip MP3 conversion and serve WAV directly. MP3 conversion adds ffmpeg dependency.

---

### 8.4 Text Chunking (Phase 3 - Future)

For MVP (500 chars max), chunking is not needed. But for future:

```python
def chunk_text(text: str, max_words: int = 120) -> list[str]:
    """
    Split text into chunks that fit within 30-second limit.
    
    Each chunk generates separately, then audio is concatenated.
    """
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current_chunk = []
    current_words = 0
    
    for sentence in sentences:
        word_count = len(sentence.split())
        if current_words + word_count > max_words and current_chunk:
            chunks.append(" ".join(current_chunk))
            current_chunk = [sentence]
            current_words = word_count
        else:
            current_chunk.append(sentence)
            current_words += word_count
    
    if current_chunk:
        chunks.append(" ".join(current_chunk))
    
    return chunks
```

---

### 8.5 Complete Helper File Structure

```
backend/
├── services/
│   ├── __init__.py
│   ├── storage.py      # File storage (existing)
│   ├── tts.py          # Modal client (existing, update)
│   ├── audio.py        # NEW: Audio validation
│   └── text.py         # NEW: Text preprocessing
```

---

### 8.6 Updated Data Flow with Helpers

```
User Upload (Clone)                 User Input (Generate)
      │                                    │
      ▼                                    ▼
┌─────────────────┐               ┌─────────────────┐
│ audio.validate  │               │ text.validate   │
│ - Format check  │               │ - Char count    │
│ - Duration check│               │ - Byte count    │
└────────┬────────┘               └────────┬────────┘
         │                                 │
         ▼                                 ▼
┌─────────────────┐               ┌─────────────────┐
│ storage.save    │               │ text.preprocess │
│ - Save to disk  │               │ - Normalize     │
└────────┬────────┘               │ - Add [S1] tag  │
         │                        └────────┬────────┘
         │                                 │
         └─────────────┬───────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   Modal GPU     │
              │   Echo-TTS      │
              │   generate()    │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ (Optional MP3)  │
              │ Save & Return   │
              └─────────────────┘
```

---

### 8.7 Updated Checklist

#### Helper Infrastructure
- [ ] Create `backend/services/audio.py`
- [ ] Create `backend/services/text.py`
- [ ] Add `mutagen` to requirements
- [ ] Update `/api/clone` to validate audio duration
- [ ] Update `/api/generate` to preprocess text
- [ ] Test with edge cases (short audio, special characters, etc.)

---

## References

- [Echo-TTS GitHub](https://github.com/jordandare/echo-tts)
- [Echo-TTS HuggingFace](https://huggingface.co/jordand/echo-tts-base)
- [Modal.com Documentation](https://modal.com/docs/guide)
- [Modal GPU Guide](https://modal.com/docs/guide/gpu)
- [Modal Pricing](https://modal.com/pricing)
