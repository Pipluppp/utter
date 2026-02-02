# Step 8: Utter API Integration

> **Context Document**: How Qwen3-TTS Modal deployment fits into the utter application
> **Prerequisites**: Completed deployment ([Step 6](./06-deployment.md))

This document explains how the Qwen3-TTS Modal service integrates with utter's voice cloning API.

---

## 8.1 Utter Architecture Overview

Utter is a voice cloning application inspired by ElevenLabs. Users upload reference audio, and the system clones their voice for text-to-speech generation.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              UTTER APPLICATION                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐     ┌──────────────────┐     ┌──────────────────────┐    │
│  │   Frontend   │     │  FastAPI Backend │     │   Modal.com (GPU)    │    │
│  │  (Vanilla JS)│────▶│                  │────▶│                      │    │
│  │              │     │  /api/clone      │     │  ┌────────────────┐  │    │
│  │  clone.html  │     │  /api/generate   │     │  │   Echo-TTS     │  │    │
│  │  generate.html     │  /api/voices     │     │  │   (current)    │  │    │
│  │  voices.html │     │                  │     │  ├────────────────┤  │    │
│  │              │     │                  │     │  │   Qwen3-TTS    │  │    │
│  └──────────────┘     └────────┬─────────┘     │  │   (planned)    │  │    │
│                                │               │  └────────────────┘  │    │
│                                ▼               └──────────────────────┘    │
│                       ┌────────────────┐                                   │
│                       │    SQLite DB   │                                   │
│                       │  ┌──────────┐  │                                   │
│                       │  │  voices  │  │                                   │
│                       │  │generations│  │                                   │
│                       │  └──────────┘  │                                   │
│                       └────────────────┘                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8.2 Current Voice Cloning Flow (Echo-TTS)

The existing flow uses Echo-TTS on Modal:

```
1. User uploads audio file (10-300 seconds)
         │
         ▼
2. POST /api/clone
   - Validate audio duration
   - Save to /uploads/references/{voice_id}.wav
   - Create Voice record in database
         │
         ▼
3. User enters text on /generate page
         │
         ▼
4. POST /api/generate
   - Load reference audio from disk
   - Preprocess text (add [S1] tags, split into chunks)
   - Call Modal Echo-TTS for each chunk
   - Stitch chunks with ffmpeg
   - Save to /uploads/generated/{gen_id}.mp3
   - Create Generation record
         │
         ▼
5. Return audio URL to frontend
```

---

## 8.3 Qwen3-TTS Integration Points

Qwen3-TTS replaces Echo-TTS as the voice cloning backend. The integration points are:

| Component | Current (Echo-TTS) | New (Qwen3-TTS) |
|-----------|-------------------|-----------------|
| Modal App | `utter-tts` | `qwen3-tts-voice-clone` |
| Modal Class | `EchoTTS` | `Qwen3TTSService` |
| Method | `generate(text, reference_audio_bytes)` | `generate_voice_clone(text, language, ref_audio, ref_text)` |
| Reference | Audio bytes only | Audio bytes + transcript |
| Languages | English only | 10 languages |
| Text limit | 768 bytes per chunk | No hard limit (2048 tokens) |

**Key Difference**: Qwen3-TTS requires a **transcript** of the reference audio, while Echo-TTS does not.

---

## 8.4 Backend Integration Code

### 8.4.1 Update TTS Service

Create or update `backend/services/tts_qwen.py`:

```python
"""
Qwen3-TTS integration for utter.

This service connects utter's backend to the Qwen3-TTS Modal deployment.
"""

import os
import logging
from pathlib import Path
from typing import Optional

import modal

from config import REFERENCES_DIR, GENERATED_DIR

logger = logging.getLogger(__name__)

# Modal app configuration
MODAL_APP_NAME = "qwen3-tts-voice-clone"
MODAL_CLASS_NAME = "Qwen3TTSService"

# Feature flag: Use mock mode for local development
USE_MOCK = os.getenv("TTS_MOCK", "false").lower() == "true"


async def generate_speech_qwen(
    voice_id: str,
    text: str,
    ref_text: str,
    language: str = "Auto",
) -> str:
    """
    Generate speech using Qwen3-TTS voice cloning.

    Args:
        voice_id: UUID of the voice to use
        text: Text to synthesize
        ref_text: Transcript of the reference audio (REQUIRED for Qwen3-TTS)
        language: Target language (default: Auto-detect)

    Returns:
        Path to the generated audio file

    Raises:
        ValueError: If voice not found or invalid parameters
        Exception: If generation fails
    """
    import uuid
    import aiofiles

    # Find reference audio
    reference_path = _get_reference_path(voice_id)
    if not reference_path:
        raise ValueError(f"Voice not found: {voice_id}")

    # Load reference audio bytes
    async with aiofiles.open(reference_path, "rb") as f:
        reference_bytes = await f.read()

    # Generate output path
    generation_id = str(uuid.uuid4())
    output_path = GENERATED_DIR / f"{generation_id}.wav"

    logger.info(f"Generating speech: voice={voice_id}, text_len={len(text)}, language={language}")

    if USE_MOCK:
        # Mock mode: copy reference as output (for testing)
        import shutil
        shutil.copy2(reference_path, output_path)
        logger.info("Mock mode: copied reference as output")
        return str(output_path)

    # Call Modal Qwen3-TTS
    try:
        Qwen3TTS = modal.Cls.from_name(MODAL_APP_NAME, MODAL_CLASS_NAME)
        tts = Qwen3TTS()

        # Convert bytes to base64 for API
        import base64
        ref_audio_base64 = base64.b64encode(reference_bytes).decode("utf-8")

        # Generate audio
        audio_bytes = tts.generate_voice_clone.remote(
            text=text,
            language=language,
            ref_audio=ref_audio_base64,
            ref_text=ref_text,
            max_new_tokens=2048,
        )

        # Save output
        async with aiofiles.open(output_path, "wb") as f:
            await f.write(audio_bytes)

        logger.info(f"Generated audio: {output_path} ({len(audio_bytes)} bytes)")
        return str(output_path)

    except Exception as e:
        logger.error(f"Qwen3-TTS generation failed: {e}")
        raise


async def generate_speech_qwen_batch(
    voice_id: str,
    texts: list[str],
    ref_text: str,
    languages: list[str] | None = None,
) -> list[str]:
    """
    Generate multiple speech files in a batch.

    More efficient than calling generate_speech_qwen multiple times
    because the voice prompt is computed once.

    Args:
        voice_id: UUID of the voice to use
        texts: List of texts to synthesize
        ref_text: Transcript of the reference audio
        languages: Languages for each text (defaults to "Auto" for all)

    Returns:
        List of paths to generated audio files
    """
    import uuid
    import base64
    import aiofiles

    if languages is None:
        languages = ["Auto"] * len(texts)

    if len(texts) != len(languages):
        raise ValueError("texts and languages must have same length")

    # Find reference audio
    reference_path = _get_reference_path(voice_id)
    if not reference_path:
        raise ValueError(f"Voice not found: {voice_id}")

    # Load reference audio bytes
    async with aiofiles.open(reference_path, "rb") as f:
        reference_bytes = await f.read()

    ref_audio_base64 = base64.b64encode(reference_bytes).decode("utf-8")

    logger.info(f"Batch generation: voice={voice_id}, items={len(texts)}")

    # Call Modal Qwen3-TTS batch endpoint
    Qwen3TTS = modal.Cls.from_name(MODAL_APP_NAME, MODAL_CLASS_NAME)
    tts = Qwen3TTS()

    audio_bytes_list = tts.generate_voice_clone_batch.remote(
        texts=texts,
        languages=languages,
        ref_audio=ref_audio_base64,
        ref_text=ref_text,
        max_new_tokens=2048,
    )

    # Save each output
    output_paths = []
    for i, audio_bytes in enumerate(audio_bytes_list):
        generation_id = str(uuid.uuid4())
        output_path = GENERATED_DIR / f"{generation_id}.wav"

        async with aiofiles.open(output_path, "wb") as f:
            await f.write(audio_bytes)

        output_paths.append(str(output_path))
        logger.info(f"  [{i+1}/{len(texts)}] Saved: {output_path}")

    return output_paths


def _get_reference_path(voice_id: str) -> Optional[Path]:
    """Find reference audio file for a voice."""
    for ext in [".wav", ".mp3", ".m4a"]:
        path = REFERENCES_DIR / f"{voice_id}{ext}"
        if path.exists():
            return path
    return None
```

### 8.4.2 Update Voice Model

The Voice model needs to store the reference transcript. Update `backend/models.py`:

```python
from sqlalchemy import Column, String, Text, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import datetime


class Voice(Base):
    """Voice model with reference audio and transcript."""

    __tablename__ = "voices"

    id = Column(String, primary_key=True)
    name = Column(String(100), nullable=False)
    reference_path = Column(String, nullable=False)

    # NEW: Store reference transcript for Qwen3-TTS
    reference_transcript = Column(Text, nullable=True)

    # NEW: Store detected/specified language
    language = Column(String(20), default="Auto")

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    generations = relationship(
        "Generation",
        back_populates="voice",
        cascade="all, delete-orphan"
    )


class Generation(Base):
    """Generation model tracking speech synthesis history."""

    __tablename__ = "generations"

    id = Column(String, primary_key=True)
    voice_id = Column(String, ForeignKey("voices.id", ondelete="CASCADE"))
    text = Column(Text, nullable=False)
    audio_path = Column(String, nullable=False)
    duration_seconds = Column(Float, nullable=True)

    # NEW: Store language used for generation
    language = Column(String(20), default="Auto")

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    voice = relationship("Voice", back_populates="generations")
```

### 8.4.3 Update Clone Endpoint

Update `backend/main.py` to collect the transcript:

```python
@app.post("/api/clone")
async def clone_voice(
    name: str = Form(...),
    audio: UploadFile = File(...),
    transcript: str = Form(...),  # NEW: Required for Qwen3-TTS
    language: str = Form("Auto"),  # NEW: Optional language hint
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new voice clone.

    Args:
        name: Display name for the voice (1-100 chars)
        audio: Reference audio file (WAV/MP3/M4A, 10-300 seconds)
        transcript: Exact transcript of the reference audio (REQUIRED)
        language: Language of the reference audio (default: Auto-detect)
    """
    import uuid

    # Validate name
    if not name or len(name) > 100:
        raise HTTPException(400, "Name must be 1-100 characters")

    # Validate transcript
    if not transcript or len(transcript) < 10:
        raise HTTPException(400, "Transcript must be at least 10 characters")

    # Validate language
    supported_languages = [
        "Auto", "Chinese", "English", "Japanese", "Korean",
        "German", "French", "Russian", "Portuguese", "Spanish", "Italian"
    ]
    if language not in supported_languages:
        raise HTTPException(400, f"Unsupported language: {language}")

    # Validate audio file
    if not audio.filename:
        raise HTTPException(400, "No file provided")

    ext = Path(audio.filename).suffix.lower()
    if ext not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(400, f"Invalid file type. Allowed: {ALLOWED_AUDIO_EXTENSIONS}")

    # Generate voice ID and save file
    voice_id = str(uuid.uuid4())
    reference_path = REFERENCES_DIR / f"{voice_id}{ext}"

    # Save uploaded file
    content = await audio.read()
    if len(content) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"File too large. Max: {MAX_FILE_SIZE_MB}MB")

    async with aiofiles.open(reference_path, "wb") as f:
        await f.write(content)

    # Validate audio duration
    duration = get_audio_duration(str(reference_path))
    if duration < MIN_AUDIO_DURATION_SECONDS:
        reference_path.unlink()
        raise HTTPException(400, f"Audio too short. Min: {MIN_AUDIO_DURATION_SECONDS}s")
    if duration > MAX_AUDIO_DURATION_SECONDS:
        reference_path.unlink()
        raise HTTPException(400, f"Audio too long. Max: {MAX_AUDIO_DURATION_SECONDS}s")

    # Create voice record
    voice = Voice(
        id=voice_id,
        name=name,
        reference_path=str(reference_path),
        reference_transcript=transcript,  # NEW
        language=language,  # NEW
    )
    db.add(voice)
    await db.commit()

    logger.info(f"Created voice: id={voice_id}, name={name}, language={language}")

    return JSONResponse(
        status_code=201,
        content={"id": voice_id, "name": name}
    )
```

### 8.4.4 Update Generate Endpoint

Update the generate endpoint to use Qwen3-TTS:

```python
from services.tts_qwen import generate_speech_qwen


@app.post("/api/generate")
async def generate_speech(
    request: GenerateRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Generate speech from text using a cloned voice.

    Args:
        voice_id: UUID of the voice to use
        text: Text to synthesize (1-5000 chars)
        language: Override language (optional, defaults to voice's language)
    """
    import uuid

    # Fetch voice from database
    result = await db.execute(
        select(Voice).where(Voice.id == request.voice_id)
    )
    voice = result.scalar_one_or_none()

    if not voice:
        raise HTTPException(404, "Voice not found")

    # Validate text
    if not request.text or len(request.text) > 5000:
        raise HTTPException(400, "Text must be 1-5000 characters")

    # Determine language
    language = request.language or voice.language or "Auto"

    # Get reference transcript (required for Qwen3-TTS)
    if not voice.reference_transcript:
        raise HTTPException(
            400,
            "Voice is missing reference transcript. "
            "Please re-create the voice with a transcript."
        )

    logger.info(f"Generating: voice={voice.name}, text_len={len(request.text)}")

    try:
        # Generate speech using Qwen3-TTS
        audio_path = await generate_speech_qwen(
            voice_id=voice.id,
            text=request.text,
            ref_text=voice.reference_transcript,
            language=language,
        )

        # Get duration
        duration = get_audio_duration(audio_path)

        # Create generation record
        generation_id = Path(audio_path).stem
        generation = Generation(
            id=generation_id,
            voice_id=voice.id,
            text=request.text,
            audio_path=audio_path,
            duration_seconds=duration,
            language=language,
        )
        db.add(generation)
        await db.commit()

        return {
            "audio_url": f"/uploads/generated/{Path(audio_path).name}",
            "generation_id": generation_id,
            "duration_seconds": duration,
        }

    except Exception as e:
        logger.error(f"Generation failed: {e}")
        raise HTTPException(500, f"Generation failed: {str(e)}")
```

---

## 8.5 Frontend Updates

### 8.5.1 Update Clone Form

Update `backend/templates/clone.html` to include transcript input:

```html
<form id="clone-form" class="clone-form">
    <div class="form-group">
        <label for="voice-name">VOICE NAME</label>
        <input
            type="text"
            id="voice-name"
            name="name"
            required
            maxlength="100"
            placeholder="My Voice"
        />
    </div>

    <div class="form-group">
        <label for="dropzone">REFERENCE AUDIO (10-300 SECONDS)</label>
        <div id="dropzone" class="dropzone">
            <p>Drag & drop audio file here</p>
            <p class="hint">or click to browse</p>
            <p class="hint">WAV, MP3, or M4A</p>
        </div>
        <input type="file" id="audio-file" name="audio" accept=".wav,.mp3,.m4a" hidden />
    </div>

    <!-- NEW: Transcript input -->
    <div class="form-group">
        <label for="transcript">REFERENCE TRANSCRIPT</label>
        <textarea
            id="transcript"
            name="transcript"
            required
            rows="4"
            placeholder="Type exactly what is spoken in the audio file..."
        ></textarea>
        <p class="hint">This must match the audio exactly for best voice cloning results</p>
    </div>

    <!-- NEW: Language selection -->
    <div class="form-group">
        <label for="language">LANGUAGE</label>
        <select id="language" name="language">
            <option value="Auto">Auto-detect</option>
            <option value="English">English</option>
            <option value="Chinese">Chinese</option>
            <option value="Japanese">Japanese</option>
            <option value="Korean">Korean</option>
            <option value="German">German</option>
            <option value="French">French</option>
            <option value="Russian">Russian</option>
            <option value="Portuguese">Portuguese</option>
            <option value="Spanish">Spanish</option>
            <option value="Italian">Italian</option>
        </select>
    </div>

    <button type="submit" class="btn btn-primary">
        CREATE VOICE CLONE
    </button>
</form>
```

### 8.5.2 Update Clone JavaScript

Update `backend/static/js/app.js` to send transcript:

```javascript
// Handle clone form submission
document.getElementById('clone-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nameInput = document.getElementById('voice-name');
    const fileInput = document.getElementById('audio-file');
    const transcriptInput = document.getElementById('transcript');
    const languageSelect = document.getElementById('language');

    const file = fileInput.files[0];
    if (!file) {
        showError('Please select an audio file');
        return;
    }

    const transcript = transcriptInput.value.trim();
    if (!transcript || transcript.length < 10) {
        showError('Please enter the transcript (at least 10 characters)');
        return;
    }

    const formData = new FormData();
    formData.append('name', nameInput.value);
    formData.append('audio', file);
    formData.append('transcript', transcript);
    formData.append('language', languageSelect.value);

    setLoading(true);

    try {
        const response = await fetch('/api/clone', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Clone failed');
        }

        const data = await response.json();
        showSuccess(`Voice "${data.name}" created successfully!`);

        // Reset form
        e.target.reset();
        document.getElementById('dropzone').classList.remove('has-file');

    } catch (error) {
        showError(error.message);
    } finally {
        setLoading(false);
    }
});
```

---

## 8.6 Configuration

### 8.6.1 Environment Variables

Add to `.env`:

```bash
# TTS Provider: "echo" or "qwen"
TTS_PROVIDER=qwen

# Qwen3-TTS Modal app name
QWEN_MODAL_APP=qwen3-tts-voice-clone
QWEN_MODAL_CLASS=Qwen3TTSService

# Mock mode for local development (no Modal required)
TTS_MOCK=false
```

### 8.6.2 Provider Selection

Create `backend/services/tts.py` as a provider router:

```python
"""
TTS provider router.

Selects between Echo-TTS and Qwen3-TTS based on configuration.
"""

import os
from typing import Optional

# Get provider from environment
TTS_PROVIDER = os.getenv("TTS_PROVIDER", "echo").lower()


async def generate_speech(
    voice_id: str,
    text: str,
    ref_text: Optional[str] = None,
    language: str = "Auto",
) -> str:
    """
    Generate speech using configured TTS provider.

    Args:
        voice_id: UUID of the voice
        text: Text to synthesize
        ref_text: Reference transcript (required for Qwen3-TTS)
        language: Target language

    Returns:
        Path to generated audio file
    """
    if TTS_PROVIDER == "qwen":
        from services.tts_qwen import generate_speech_qwen

        if not ref_text:
            raise ValueError("Qwen3-TTS requires reference transcript")

        return await generate_speech_qwen(
            voice_id=voice_id,
            text=text,
            ref_text=ref_text,
            language=language,
        )

    else:  # Default to Echo-TTS
        from services.tts_echo import generate_speech_echo

        return await generate_speech_echo(
            voice_id=voice_id,
            text=text,
        )
```

---

## 8.7 Database Migration

If you have existing voices without transcripts, create a migration:

```python
"""
Add reference_transcript and language columns to voices table.

Run with: alembic upgrade head
"""

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column(
        'voices',
        sa.Column('reference_transcript', sa.Text(), nullable=True)
    )
    op.add_column(
        'voices',
        sa.Column('language', sa.String(20), server_default='Auto')
    )


def downgrade():
    op.drop_column('voices', 'reference_transcript')
    op.drop_column('voices', 'language')
```

---

## 8.8 End-to-End Flow

After integration, the complete voice cloning flow becomes:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           VOICE CLONING FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. CREATE VOICE                                                            │
│  ───────────────                                                            │
│  User uploads:                                                              │
│    • Audio file (10-300s reference recording)                               │
│    • Transcript (exact text spoken in audio)                                │
│    • Language (optional, defaults to Auto)                                  │
│    • Name (display name for voice)                                          │
│                                                                             │
│           │                                                                 │
│           ▼                                                                 │
│                                                                             │
│  2. STORE VOICE                                                             │
│  ──────────────                                                             │
│  Backend saves:                                                             │
│    • Audio → /uploads/references/{voice_id}.wav                             │
│    • Metadata → SQLite (id, name, transcript, language)                     │
│                                                                             │
│           │                                                                 │
│           ▼                                                                 │
│                                                                             │
│  3. GENERATE SPEECH                                                         │
│  ─────────────────                                                          │
│  User provides:                                                             │
│    • voice_id (which voice to use)                                          │
│    • text (what to say)                                                     │
│    • language (optional override)                                           │
│                                                                             │
│           │                                                                 │
│           ▼                                                                 │
│                                                                             │
│  4. CALL MODAL QWEN3-TTS                                                    │
│  ───────────────────────                                                    │
│  Backend sends to Modal:                                                    │
│    • text: "Hello, this is a test"                                          │
│    • ref_audio: base64(reference.wav)                                       │
│    • ref_text: "This is my voice sample..."                                 │
│    • language: "English"                                                    │
│                                                                             │
│           │                                                                 │
│           ▼                                                                 │
│                                                                             │
│  5. MODAL PROCESSING (GPU)                                                  │
│  ─────────────────────────                                                  │
│  Qwen3-TTS on A10G GPU:                                                     │
│    • Load model (cached in container)                                       │
│    • Create voice prompt from reference                                     │
│    • Generate audio tokens                                                  │
│    • Decode to waveform                                                     │
│    • Return WAV bytes                                                       │
│                                                                             │
│           │                                                                 │
│           ▼                                                                 │
│                                                                             │
│  6. RETURN AUDIO                                                            │
│  ───────────────                                                            │
│  Backend:                                                                   │
│    • Saves WAV to /uploads/generated/{gen_id}.wav                           │
│    • Creates Generation record in DB                                        │
│    • Returns audio URL to frontend                                          │
│                                                                             │
│  Frontend:                                                                  │
│    • Displays audio player                                                  │
│    • Shows waveform visualization                                           │
│    • Enables download                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8.9 API Comparison

| Feature | Echo-TTS | Qwen3-TTS |
|---------|----------|-----------|
| Reference audio | Required | Required |
| Reference transcript | Not needed | **Required** |
| Languages | English only | 10 languages |
| Model sizes | Single | 0.6B, 1.7B |
| Streaming | No | Yes (97ms first packet) |
| Voice quality | Good | Better |
| Cold start | ~30-60s | ~30-60s |
| Generation time | ~5-10s | ~5-10s |

---

## 8.10 Checklist

Before going live with Qwen3-TTS:

- [ ] Modal deployment complete ([Step 6](./06-deployment.md))
- [ ] Health endpoint returns healthy
- [ ] Backend `tts_qwen.py` service created
- [ ] Voice model updated with `reference_transcript` column
- [ ] Clone endpoint accepts transcript
- [ ] Generate endpoint uses Qwen3-TTS
- [ ] Frontend clone form has transcript input
- [ ] Database migrated (if existing data)
- [ ] Environment variable `TTS_PROVIDER=qwen` set
- [ ] End-to-end test successful

---

## 8.11 Testing the Integration

### Test 1: Create Voice with Transcript

```bash
curl -X POST http://localhost:8000/api/clone \
  -F "name=Test Voice" \
  -F "audio=@reference.wav" \
  -F "transcript=Hello, this is my voice sample for testing." \
  -F "language=English"
```

### Test 2: Generate Speech

```bash
curl -X POST http://localhost:8000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "voice_id": "uuid-from-step-1",
    "text": "This is a test of the voice cloning system."
  }'
```

### Test 3: Verify Audio

```bash
# Download and play the generated audio
curl -O http://localhost:8000/uploads/generated/gen-uuid.wav
afplay gen-uuid.wav  # macOS
```

---

## Summary

This integration connects utter's voice cloning UI to Qwen3-TTS on Modal:

1. **User uploads** reference audio + transcript
2. **Backend stores** audio file and metadata
3. **User requests** speech generation
4. **Backend calls** Modal Qwen3-TTS with reference + text
5. **Modal returns** generated audio
6. **User receives** cloned voice speaking their text

The key addition for Qwen3-TTS is the **reference transcript** requirement, which enables better voice cloning quality across 10 languages.
