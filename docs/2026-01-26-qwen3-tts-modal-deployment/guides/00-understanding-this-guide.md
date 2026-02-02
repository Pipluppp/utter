# Understanding This Guide: Qwen3-TTS on Modal for Utter

> **Purpose**: This document explains *why* we're doing what we're doing, not just *how*. Read this first if you want to understand the full context before implementing.

---

## Background

### Deep Background: The Voice Cloning Landscape (Skip if Familiar)

Voice cloning technology lets you capture someone's voice from a short audio sample and then generate new speech in that voice. Think of it like this:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  "Hello, I'm    │     │                 │     │  "The weather   │
│   recording     │ ──▶ │   AI Model      │ ──▶ │   today is      │
│   my voice"     │     │                 │     │   sunny"        │
│                 │     │                 │     │                 │
│  (10s sample)   │     │  (learns voice) │     │  (new speech)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
     Reference              Voice Cloning           Generated
       Audio                   Model                  Audio
```

The AI model extracts characteristics like:
- **Timbre**: The unique "color" of a voice
- **Pitch patterns**: How the voice rises and falls
- **Speaking rhythm**: Pace, pauses, emphasis
- **Accent/pronunciation**: Regional speech patterns

Modern voice cloning models like Qwen3-TTS achieve this through a **discrete multi-codebook language model** architecture. Don't worry about the technical details—just know that it treats audio like a language, converting sound waves into "tokens" (like words) that a transformer can understand and generate.

### Narrow Background: Utter's Current Architecture

**Utter** is our voice cloning web application. Currently it uses **Echo-TTS** for voice cloning:

```
┌─────────────────────────────────────────────────────────────────┐
│                        CURRENT UTTER STACK                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Browser                FastAPI Backend           Modal.com    │
│   ───────                ───────────────           ─────────    │
│                                                                 │
│   ┌─────────┐           ┌─────────────┐          ┌───────────┐ │
│   │ clone   │──POST────▶│ /api/clone  │          │           │ │
│   │ .html   │           │             │          │  Echo-TTS │ │
│   └─────────┘           │  - validate │          │  (A10G)   │ │
│                         │  - save file│          │           │ │
│   ┌─────────┐           │  - store DB │          │  generate │ │
│   │generate │──POST────▶│             │─────────▶│  (text,   │ │
│   │ .html   │           │ /api/generate          │   ref)    │ │
│   └─────────┘           │             │◀─────────│           │ │
│       ▲                 └─────────────┘  audio   └───────────┘ │
│       │                        │                               │
│       └────────────────────────┘                               │
│              audio URL                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**The limitation**: Echo-TTS only supports English. Users want to clone voices in other languages.

### Why Qwen3-TTS?

Qwen3-TTS is Alibaba's open-source TTS model released in January 2026. Key advantages:

| Feature | Echo-TTS | Qwen3-TTS |
|---------|----------|-----------|
| Languages | English only | **10 languages** |
| Model sizes | Single | 0.6B and 1.7B |
| Voice quality | Good | Better |
| Streaming | No | Yes (97ms latency) |
| Open source | Yes | Yes (Apache 2.0) |

**The catch**: Qwen3-TTS requires a **transcript** of the reference audio. Echo-TTS figures out the voice from audio alone; Qwen3-TTS needs to know what words are being spoken to better align the voice characteristics.

### Why Modal.com?

Running AI models requires GPUs. Options:

| Option | Pros | Cons |
|--------|------|------|
| Local GPU | Fast iteration | Expensive hardware, always-on costs |
| Cloud VMs (AWS/GCP) | Flexible | Complex setup, pay while idle |
| **Modal.com** | **Serverless, pay-per-use, simple Python API** | Vendor lock-in |

Modal lets us write Python code that magically runs on GPUs in the cloud:

```python
# This runs on YOUR laptop
@app.function(gpu="A10G")
def generate_speech(text):
    # This code runs on Modal's GPU
    model = load_model()
    return model.generate(text)

# Call it like a normal function
audio = generate_speech.remote("Hello world")
```

No Docker, no Kubernetes, no infrastructure management. Perfect for our use case.

---

## Intuition

### Core Problem: Getting Qwen3-TTS Running on Modal

Let's trace through what happens when a user wants to clone their voice:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    THE VOICE CLONING JOURNEY                             │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  STEP 1: User records themselves saying:                                 │
│          "Hello, my name is Alex and I love coding"                      │
│                        │                                                 │
│                        ▼                                                 │
│  STEP 2: User uploads audio + types the transcript                       │
│          ┌─────────────────────────────────────────┐                     │
│          │  Audio: [10 second WAV file]            │                     │
│          │  Transcript: "Hello, my name is Alex    │                     │
│          │              and I love coding"         │                     │
│          │  Language: English                      │                     │
│          └─────────────────────────────────────────┘                     │
│                        │                                                 │
│                        ▼                                                 │
│  STEP 3: Later, user wants to generate new speech:                       │
│          "The quick brown fox jumps over the lazy dog"                   │
│                        │                                                 │
│                        ▼                                                 │
│  STEP 4: System combines reference + new text:                           │
│          ┌─────────────────────────────────────────┐                     │
│          │  Qwen3-TTS receives:                    │                     │
│          │  - ref_audio: [Alex's voice sample]    │                     │
│          │  - ref_text: "Hello, my name is Alex   │                     │
│          │              and I love coding"         │                     │
│          │  - text: "The quick brown fox..."       │                     │
│          │  - language: "English"                  │                     │
│          └─────────────────────────────────────────┘                     │
│                        │                                                 │
│                        ▼                                                 │
│  STEP 5: Qwen3-TTS generates audio in Alex's voice                       │
│          saying "The quick brown fox..."                                 │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### The Transcript Requirement: Why It Matters

Imagine trying to learn someone's accent by listening to them speak a language you don't understand. Hard, right? You might pick up some sounds, but you'd miss nuances.

Now imagine someone hands you a transcript. Suddenly you can see:
- "Oh, they pronounce 'water' as 'wah-ter' not 'waw-ter'"
- "They stress the second syllable in 'today'"
- "They pause after conjunctions"

That's what the transcript does for Qwen3-TTS. It aligns the audio with known words, making voice extraction much more accurate.

```
WITHOUT TRANSCRIPT:                    WITH TRANSCRIPT:
─────────────────────                  ─────────────────────
Audio: ▓▓▓▓░░▓▓▓░░▓▓▓                 Audio: ▓▓▓▓░░▓▓▓░░▓▓▓
       ↓   ↓   ↓                             ↓   ↓   ↓
Model: "Some sounds...                Text:  "Hello my name"
        maybe words?"                        ↓   ↓   ↓
                                      Model: "H sound = ▓▓
                                              vowel = ▓▓
                                              rhythm = ░░"
```

### The Deployment Challenge: Flash Attention

Here's where it gets tricky. Qwen3-TTS documentation shows:

```python
model = Qwen3TTSModel.from_pretrained(
    "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
    attn_implementation="flash_attention_2",  # <-- This line
)
```

**Flash Attention 2** is a CUDA optimization that makes transformers faster. Problem: it requires **compiling C++ code** during installation:

```bash
pip install flash-attn --no-build-isolation
# This triggers: gcc, nvcc (CUDA compiler), ninja...
# Takes 20-30 minutes and often fails!
```

On Modal's serverless containers, we can't afford 30-minute compilation on every cold start.

### The Solution: SDPA Fallback

Turns out, Flash Attention is **optional**. PyTorch 2.0+ has a built-in alternative called **Scaled Dot-Product Attention (SDPA)**:

```
┌───────────────────────────────────────────────────────────────┐
│              ATTENTION IMPLEMENTATION FALLBACK                │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│   TRY 1: flash_attention_2                                    │
│          ├── Fastest (custom CUDA kernels)                    │
│          └── Requires: pip install flash-attn (compilation)   │
│                    │                                          │
│                    │ if not available                         │
│                    ▼                                          │
│   TRY 2: sdpa (Scaled Dot-Product Attention)                  │
│          ├── Fast (PyTorch native, uses cuDNN)                │
│          └── Requires: PyTorch >= 2.0 (already installed!)    │
│                    │                                          │
│                    │ if not available                         │
│                    ▼                                          │
│   TRY 3: eager                                                │
│          ├── Slowest (pure Python loops)                      │
│          └── Requires: Nothing (always works)                 │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

Our code automatically detects what's available:

```python
def get_attention_implementation():
    # Try Flash Attention
    if flash_attn_installed():
        return "flash_attention_2"

    # Try SDPA (PyTorch native)
    if hasattr(torch.nn.functional, "scaled_dot_product_attention"):
        return "sdpa"  # ← This is what we'll use

    # Fallback to eager
    return "eager"
```

**Result**: No compilation needed, starts in seconds, only ~10-20% slower than Flash Attention.

### Model Caching: Avoiding Cold Start Downloads

Another problem: the 1.7B model is ~7GB. Downloading on every cold start = 5-10 minute waits.

**Solution**: Modal Volumes

```
┌─────────────────────────────────────────────────────────────────┐
│                     MODAL VOLUME CACHING                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   FIRST TIME (one-time setup):                                  │
│   ────────────────────────────                                  │
│                                                                 │
│   modal run download_models.py                                  │
│          │                                                      │
│          ▼                                                      │
│   ┌─────────────────────────────┐                               │
│   │    HuggingFace Hub          │                               │
│   │    (7GB download)           │                               │
│   └─────────────────────────────┘                               │
│          │                                                      │
│          ▼                                                      │
│   ┌─────────────────────────────┐                               │
│   │    Modal Volume             │   Persists across             │
│   │    /vol/models/             │   container restarts!         │
│   │    └── Qwen3-TTS-1.7B/      │                               │
│   │        ├── config.json      │                               │
│   │        └── model.safetensors│                               │
│   └─────────────────────────────┘                               │
│                                                                 │
│   EVERY REQUEST AFTER:                                          │
│   ────────────────────                                          │
│                                                                 │
│   Container starts                                              │
│          │                                                      │
│          ▼                                                      │
│   Load from /vol/models/ (local disk speed!)                    │
│          │                                                      │
│          ▼                                                      │
│   Ready in ~30-60 seconds (GPU memory load)                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Code Walkthrough

### File Structure Overview

```
docs/qwen3-tts-modal-deployment/
│
├── README.md                    # Entry point, architecture diagram
│
├── 01-prerequisites.md          # Setup: CLI, secrets, volumes
│   └── Creates: config.py
│
├── 02-image-building.md         # Container image definition
│   └── Creates: create_image() function
│
├── 03-model-caching.md          # Pre-download models
│   └── Creates: download_models.py
│
├── 04-core-service.md           # Model loading & generation
│   └── Creates: Qwen3TTSService class with @modal.enter()
│
├── 05-api-endpoints.md          # REST API
│   └── Creates: /clone, /health endpoints
│
├── 06-deployment.md             # Deploy & test
│   └── Creates: test_client.py
│
├── 07-troubleshooting.md        # Debug guide
│
└── 08-utter-integration.md      # Backend integration
    └── Creates: tts_qwen.py, model updates, frontend changes
```

### Key Code Changes Explained

#### 1. The Image Builder (02-image-building.md)

```python
def create_image() -> modal.Image:
    # Start with minimal Debian + Python 3.12
    image = modal.Image.debian_slim(python_version="3.12")

    # Install audio processing libraries
    # These are SYSTEM packages (apt), not Python packages
    image = image.apt_install(
        "sox",           # Audio format conversion CLI
        "libsox-fmt-all", # SOX format plugins
        "libsndfile1",   # Required by Python soundfile package
        "ffmpeg",        # Audio stitching
    )

    # Tell HuggingFace where to cache models
    # This points to our Modal Volume!
    image = image.env({
        "HF_HOME": "/vol/models/huggingface",
    })

    # Install Python packages
    # Note: qwen-tts pins transformers==4.57.3
    image = image.pip_install(
        "qwen-tts",        # The main package
        "fastapi[standard]", # Web framework
        "soundfile",       # Audio I/O
    )

    return image
```

**Why this matters**: Modal builds images incrementally. Each method call (`apt_install`, `pip_install`) creates a cached layer. Changing code doesn't rebuild dependencies.

#### 2. The Service Class (04-core-service.md)

```python
@app.cls(
    gpu="A10G",                    # 24GB VRAM
    scaledown_window=300,          # Keep warm 5 minutes
    volumes={"/vol/models": vol},  # Mount the volume
)
class Qwen3TTSService:

    @modal.enter()  # Runs ONCE when container starts
    def load_model(self):
        # This stays in GPU memory across requests!
        self.model = Qwen3TTSModel.from_pretrained(
            "/vol/models/Qwen3-TTS-12Hz-1.7B-Base",
            device_map="cuda:0",
            dtype=torch.bfloat16,
            attn_implementation="sdpa",  # Our fallback
        )

    @modal.method()  # Callable from outside
    def generate_voice_clone(self, text, ref_audio, ref_text, language):
        # Model is already loaded! Just generate.
        wavs, sr = self.model.generate_voice_clone(
            text=text,
            ref_audio=ref_audio,
            ref_text=ref_text,
            language=language,
        )
        return audio_to_bytes(wavs[0], sr)
```

**The `@modal.enter()` pattern is crucial**: Without it, the model would reload on every request (30-60s). With it, the model loads once and serves hundreds of requests.

#### 3. The Utter Integration (08-utter-integration.md)

The key change is adding transcript support:

```python
# OLD (Echo-TTS) - transcript not needed
class Voice(Base):
    id = Column(String)
    name = Column(String)
    reference_path = Column(String)

# NEW (Qwen3-TTS) - transcript required!
class Voice(Base):
    id = Column(String)
    name = Column(String)
    reference_path = Column(String)
    reference_transcript = Column(Text)  # NEW!
    language = Column(String)            # NEW!
```

And the API call changes:

```python
# OLD (Echo-TTS)
audio = tts.generate.remote(
    text=text,
    reference_audio_bytes=ref_bytes,
)

# NEW (Qwen3-TTS)
audio = tts.generate_voice_clone.remote(
    text=text,
    ref_audio=ref_bytes_base64,
    ref_text=voice.reference_transcript,  # NEW!
    language=voice.language,              # NEW!
)
```

---

## Verification

### How We Verified This Works

#### 1. Image Build Test

```bash
modal run app.py
```

This runs a simple function that imports all packages. If the image is misconfigured, it fails here.

**Expected output**:
```
Import test results:
  torch_version: 2.x.x
  cuda_available: True
  qwen_tts: importable
```

#### 2. Model Download Verification

```bash
modal run download_models.py --model-size 1.7B
modal volume ls qwen3-tts-models
```

**Expected output**:
```
Qwen3-TTS-12Hz-1.7B-Base/
├── config.json
├── model.safetensors (6.7 GB)
└── ...
```

#### 3. End-to-End Generation Test

```bash
modal run app.py  # Uses the test entrypoint
```

This:
1. Loads the model
2. Downloads a sample reference audio
3. Generates speech
4. Saves to `test_output.wav`

**Listen to the file** to verify voice cloning worked.

#### 4. API Endpoint Test

```bash
# Start dev server
modal serve app.py

# In another terminal
curl https://your-endpoint/health
```

**Expected response**:
```json
{
  "status": "healthy",
  "model": "Qwen3-TTS-12Hz-1.7B-Base",
  "attention_implementation": "sdpa"
}
```

### Manual QA Checklist

1. **Voice Creation**
   - [ ] Upload a 10-30 second audio file
   - [ ] Enter the exact transcript
   - [ ] Select language
   - [ ] Voice appears in list

2. **Speech Generation**
   - [ ] Select the voice
   - [ ] Enter new text
   - [ ] Generate audio
   - [ ] Audio plays in browser
   - [ ] Voice sounds like the reference

3. **Quality Checks**
   - [ ] No robotic artifacts
   - [ ] Natural pronunciation
   - [ ] Correct language/accent

---

## Alternatives Considered

### Alternative 1: Compile Flash Attention in Image Build

Instead of using SDPA fallback, we could compile Flash Attention during image build.

| Pros | Cons |
|------|------|
| Fastest possible inference | 20-30 minute image builds |
| Matches official documentation | Compilation can fail randomly |
| | Larger image size |
| | CUDA version compatibility issues |

**Why we didn't choose this**: The SDPA fallback is only ~10-20% slower, and it "just works" without compilation headaches. For a voice cloning app where users wait 5-10 seconds anyway, this tradeoff makes sense.

### Alternative 2: Use Echo-TTS for English, Qwen3-TTS for Other Languages

Run both models and route based on language.

| Pros | Cons |
|------|------|
| Keep existing English voices working | Two models = double GPU costs |
| Gradual migration path | Complex routing logic |
| | Different API signatures to maintain |
| | Confusing UX (some voices need transcript, some don't) |

**Why we didn't choose this**: The complexity isn't worth it. Better to migrate fully to Qwen3-TTS and require transcripts for all voices. Users creating new voices will provide transcripts naturally.

---

## Quiz

Test your understanding of this implementation:

### 1. Why does Qwen3-TTS require a transcript of the reference audio?

<details>
<summary>A) To verify the audio file isn't corrupted</summary>

❌ **Incorrect.** Audio validation happens separately and doesn't require text comparison. The transcript serves a different purpose in the voice cloning pipeline.
</details>

<details>
<summary>B) To align speech characteristics with known words for better voice extraction</summary>

✅ **Correct!** The transcript helps Qwen3-TTS understand *what* is being said so it can better analyze *how* it's being said—the pronunciation, rhythm, and voice characteristics.
</details>

<details>
<summary>C) To generate captions for accessibility</summary>

❌ **Incorrect.** While transcripts are useful for accessibility, that's not why Qwen3-TTS requires them. The model uses the transcript for voice feature extraction, not captioning.
</details>

<details>
<summary>D) To check for copyright violations in the audio</summary>

❌ **Incorrect.** The model doesn't perform content moderation. The transcript is a technical requirement for the voice cloning algorithm.
</details>

---

### 2. What happens if Flash Attention 2 is not installed?

<details>
<summary>A) The model refuses to load and throws an error</summary>

❌ **Incorrect.** Our implementation includes a fallback mechanism. The model will still load using an alternative attention implementation.
</details>

<details>
<summary>B) The code falls back to SDPA, then eager attention if needed</summary>

✅ **Correct!** The `get_attention_implementation()` function tries Flash Attention first, then SDPA (PyTorch native), then eager as a last resort. SDPA is nearly as fast as Flash Attention.
</details>

<details>
<summary>C) The model automatically installs Flash Attention</summary>

❌ **Incorrect.** Installing packages at runtime isn't possible in Modal's serverless environment. The fallback mechanism avoids the need for installation entirely.
</details>

<details>
<summary>D) Generation works but produces lower quality audio</summary>

❌ **Incorrect.** The attention implementation affects *speed*, not *quality*. The audio output is identical regardless of which attention backend is used.
</details>

---

### 3. Why do we pre-download models to a Modal Volume instead of downloading on demand?

<details>
<summary>A) Modal doesn't allow network access during function execution</summary>

❌ **Incorrect.** Modal containers have full network access. The issue is time, not capability.
</details>

<details>
<summary>B) To avoid 5-10 minute cold start delays when downloading the 7GB model</summary>

✅ **Correct!** The 1.7B model is ~7GB. Downloading this on every cold start would make the service unusably slow. Volumes persist across container restarts, so we download once and load from local disk thereafter.
</details>

<details>
<summary>C) HuggingFace rate limits prevent repeated downloads</summary>

❌ **Incorrect.** While HuggingFace does have rate limits, they're not strict enough to block normal usage. The main motivation is cold start performance.
</details>

<details>
<summary>D) The model files are encrypted and need preprocessing</summary>

❌ **Incorrect.** Model files (safetensors) are not encrypted. They're downloaded and used directly.
</details>

---

### 4. What does `@modal.enter()` do in the service class?

<details>
<summary>A) Validates that the user has permission to enter the service</summary>

❌ **Incorrect.** Modal handles authentication separately. The `@modal.enter()` decorator is about container lifecycle, not authorization.
</details>

<details>
<summary>B) Runs code once when a container starts, keeping results in memory for subsequent requests</summary>

✅ **Correct!** This is crucial for ML models. The decorated method runs once per container, and `self.model` stays in GPU memory. Without this, we'd reload the model on every request (30-60 seconds each time).
</details>

<details>
<summary>C) Creates a new container for each incoming request</summary>

❌ **Incorrect.** That's the opposite of what we want! `@modal.enter()` helps us *reuse* containers by running initialization once and serving many requests.
</details>

<details>
<summary>D) Enters a critical section to prevent concurrent access</summary>

❌ **Incorrect.** Modal handles concurrency differently (via `@modal.concurrent`). The `enter` in the name refers to "entering" the container lifecycle, not a mutex.
</details>

---

### 5. When integrating with Utter, why do we add a `reference_transcript` column to the Voice model?

<details>
<summary>A) To store a backup of the audio in text form</summary>

❌ **Incorrect.** The transcript isn't a backup—it's the exact text spoken in the reference audio, which Qwen3-TTS needs for voice extraction.
</details>

<details>
<summary>B) To enable full-text search of voices</summary>

❌ **Incorrect.** While you could search transcripts, that's not why we added this column. It's a technical requirement of Qwen3-TTS.
</details>

<details>
<summary>C) Because Qwen3-TTS needs the transcript at generation time to clone the voice accurately</summary>

✅ **Correct!** Unlike Echo-TTS (which only needs audio), Qwen3-TTS requires both the reference audio AND its transcript. We store it in the database so it's available when the user generates speech later.
</details>

<details>
<summary>D) To automatically generate subtitles for generated audio</summary>

❌ **Incorrect.** The transcript is of the *reference* audio, not the generated audio. It's used as input to the model, not as output metadata.
</details>

---

## Summary

This guide explained how to deploy Qwen3-TTS on Modal.com for the Utter voice cloning application:

1. **Background**: Utter needs multi-language voice cloning; Qwen3-TTS provides it
2. **Challenge**: Flash Attention compilation fails on serverless; SDPA is the solution
3. **Architecture**: Modal Volumes cache models; `@modal.enter()` keeps them loaded
4. **Integration**: Add transcript to Voice model; update API to pass transcript to Qwen3-TTS

The key insight: **Qwen3-TTS needs transcripts, Echo-TTS doesn't.** This one difference drives all the code changes—database schema, API endpoints, and frontend forms.
