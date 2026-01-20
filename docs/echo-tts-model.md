# Echo-TTS Model Reference

> **Source**: [Blog Post](https://jordandarefsky.com/blog/2025/echo/) | [GitHub](https://github.com/jordandare/echo-tts) | [HuggingFace](https://huggingface.co/jordand/echo-tts-base)

---

## ⚠️ KEY USAGE CONSTRAINTS (Read First)

These are the critical limits you need to know when building your app:

### Audio Generation Limits

| Constraint | Limit | Notes |
|-----------|-------|-------|
| **Max output duration** | **30 seconds** | Fixed limit, model generates up to 640 latents |
| **Min output duration** | No minimum | Short text = short output (auto-padded) |
| **Sample rate** | 44.1 kHz | Output audio is high quality |

> [!IMPORTANT]
> **Text-to-duration behavior**: The default model behavior tries to fit ALL your text into 30 seconds. If you give it 2 paragraphs, it will speak faster to fit it in. If you give it one sentence, it speaks naturally and pads the rest with silence.
> **Note**: Advanced "Temporal Rescaling" parameters (k, sigma) can alter this behavior.

### Reference Audio (Voice Cloning) Limits

| Constraint | Limit | Notes |
|-----------|-------|-------|
| **Max reference audio** | **5 minutes** | Upper limit for conditioning |
| **Recommended minimum** | **10+ seconds** | Shorter clips work well |
| **Sweet spot** | **30-60 seconds** | Good balance of quality vs processing |

> [!TIP]
> You don't need long reference audio! Even **10 seconds of clean speech** produces good cloning results.

### Text Input Constraints

| Constraint | Limit | Notes |
|-----------|-------|-------|
| **Max text length** | ~768 UTF-8 bytes | Enforced by model |
| **Format** | Plain text + punctuation | No SSML or special markup |
| **Speaker tag** | `[S1]` auto-prepended | Can be explicit for multi-speaker |

---

## 📝 TEXT PROMPT FORMAT (Important for UX)

The model uses a specific text format based on WhisperD transcription style:

### Punctuation Effects

| Punctuation | Effect on Speech |
|-------------|------------------|
| **Comma** `,` | **Pause** (short) |
| **Period** `.` | Pause + falling intonation |
| **Question mark** `?` | Rising intonation |
| **Exclamation** `!` | More expressive, but may reduce quality |
| **Colon** `:` | Converted to comma (pause) |
| **Semicolon** `;` | Converted to comma (pause) |
| **Emdash** `—` | Converted to comma (pause) |

### Best Practices for Users

```
✅ GOOD: "Hello, I'm excited to try this. How does it sound?"
   → Natural pauses, clear phrasing

❌ AVOID: "Hello I'm excited to try this how does it sound"
   → No pauses, rushed delivery

⚠️ CAREFUL: "WOW!!! This is AMAZING!!!"
   → May be expressive but potentially lower quality
```

### Speaker Tags

```python
# Single speaker (default)
text = "Hello, this is a test."         # [S1] auto-prepended
text = "[S1] Hello, this is a test."    # Explicit, same result

# Multi-speaker (if trained for it)
text = "[S1] Hello. [S2] Hi there."     # Conversation format
```

---

## 🔧 CHUNKING STRATEGY FOR LONG TEXT

Since the model maxes out at 30 seconds, you need to chunk longer content:

### When to Chunk

| Text Length | Audio Estimate | Action |
|-------------|---------------|--------|
| 1-2 sentences | ~5-15 seconds | ✅ No chunking needed |
| 1 paragraph | ~20-30 seconds | ✅ Usually fits |
| Multiple paragraphs | 30+ seconds | ⚠️ **Must chunk** |

### Chunking Rules

1. **Split at natural boundaries**: sentences, paragraphs
2. **Keep chunks under ~100-150 words** (~20-25 seconds of speech)
3. **Overlap or crossfade** audio when concatenating
4. **Use same reference audio** for consistent voice

### Example Chunking Logic

```python
def chunk_text(text: str, max_words: int = 120) -> list[str]:
    """Split text into chunks that fit within 30-second limit."""
    sentences = text.split('. ')
    chunks = []
    current_chunk = []
    current_words = 0
    
    for sentence in sentences:
        word_count = len(sentence.split())
        if current_words + word_count > max_words:
            chunks.append('. '.join(current_chunk) + '.')
            current_chunk = [sentence]
            current_words = word_count
        else:
            current_chunk.append(sentence)
            current_words += word_count
    
    if current_chunk:
        chunks.append('. '.join(current_chunk) + '.')
    
    return chunks
```

---

## 📊 Model Specifications

| Spec | Value |
|------|-------|
| Model Size | 2.4B parameters |
| Architecture | Diffusion Transformer (DiT) |
| Audio Codec | Fish-Speech S1-DAC |
| Output Quality | 44.1 kHz |
| Inference Speed | ~1.45s for 30s audio (A100) |
| Min VRAM | 8GB (with adjustments) |
| Recommended VRAM | 16-24GB |
| **Max Sequence** | 640 latents (~30s) |

### Available Text Presets (Styles)
The model has been observed to handle various text styles which act as "soft prompts" for prosody:
- **Conversation**: `[S1] ... [S2] ...` (Natural turn-taking)
- **Reading**: Narrative, descriptive text.
- **Single (Disfluent)**: "Um, you know, I think, uh..." (Natural hesitation)
- **Singing**: Lyrics with `(singing)` tags.
- **Cartoon**: Expressive, exaggerated patterns.

---

## ⚡ VRAM Requirements

| VRAM | Configuration | Max Duration |
|------|--------------|--------------|
| **8GB** | BF16 + reduced latents (576) | ~27 seconds |
| **16GB** | Default settings | 30 seconds |
| **24GB+** | Comfortable headroom | 30 seconds |

For 8GB cards, adjust:
```python
FISH_AE_DTYPE = torch.bfloat16  # Instead of float32
DEFAULT_SAMPLE_LATENT_LENGTH = 576  # Instead of 640
```

---

## 🎛️ Key Generation Parameters

| Parameter | Default | Effect |
|-----------|---------|--------|
| `num_steps` | 40 | Diffusion steps (more = better quality, slower) |
| `cfg_scale_text` | 3.0 | How closely to follow text (higher = stricter) |
| `cfg_scale_speaker` | 8.0 | How closely to match speaker (higher = more similar) |
| `sequence_length` | 640 | Latent length (~30s). Reduce for shorter output |

### "Force Speaker" Mode (Speaker KV Scaling)

If the model generates wrong voice for unusual text:
- **Enable Speaker KV Scaling**: Scales speaker attention key-values.
- **Use Case**: When model-generated audio does not match reference audio at all (i.e. ignores speaker-reference).
- **Default value**: ~1.5 when enabled.

---

## ⚙️ Advanced Generation Parameters

Reference configuration from the official Echo-TTS Gradient demo.

### 1. Generation Controls
| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| **Sampler Preset** | `default` | `Independent`, `High Speaker CFG` | Quick configuration presets. |
| **RNG Seed** | `0` | Integer | Fixed seed for reproducibility. |
| **Num Steps** | `40` | 20-80 | Sampling steps. Higher = better quality, slower. |

### 2. CFG (Classifier Free Guidance)
| Parameter | Default | Option | Description |
|-----------|---------|--------|-------------|
| **CFG Mode** | `independent` | `independent` (3 NFE)<br>`apg-independent` (3 NFE)<br>`alternating` (2 NFE)<br>`joint-unconditional` (2 NFE) | Sampling strategy. "NFE" = Number of Function Evaluations (lower is faster). |
| **Text CFG Scale** | `3.0` | Float | **Guidance strength for text**.<br>Higher = stricter adherence to text content.<br>Lower = more creative prosody. |
| **Speaker CFG Scale** | `8.0` | Float | **Guidance strength for speaker**.<br>Higher = closer match to reference voice.<br>Lower = more variation. |
| **CFG Min t** | `0.5` | 0.0 - 1.0 | Start time (t) for applying guidance. |
| **CFG Max t** | `1.0` | 0.0 - 1.0 | End time (t) for applying guidance. |

### 3. Speaker KV Scaling (Force Speaker)
*Use when model ignores the reference voice.*
- **Enable Speaker KV Scaling**: Scales speaker attention key-values.
- **Goal**: Forces the model to pay more attention to the reference during attention layers.
- **Default**: Off (or ~1.5 scale when enabled).

### 4. Truncation & Temporal Rescaling
Controls the "pacing" and artifact reduction.

| Parameter | Default | Description |
|-----------|---------|-------------|
| **Truncation Factor** | `1.0` | Multiplies initial noise. Values < 1.0 can reduce artifacts. |
| **Rescale k** | `1.0` | **Sharpness vs Flatness**.<br>`< 1.0`: Sharpen (slower/clearer speech)<br>`> 1.0`: Flatten (faster/smoother speech)<br>`1.0`: Off |
| **Rescale σ (Sigma)** | `3.0` | Sigma parameter for the rescaling schedule. |
| **Custom Shapes** | Off | Advanced override for sequence lengths (Text/Speaker/Latent). |

---

## 🔗 Integration Code

### Basic Generation

```python
from inference import (
    load_model_from_hf,
    load_fish_ae_from_hf,
    load_pca_state_from_hf,
    load_audio,
    sample_pipeline,
    sample_euler_cfg_independent_guidances,
)
from functools import partial
import torchaudio

# Load models (downloads on first run)
model = load_model_from_hf()
fish_ae = load_fish_ae_from_hf()
pca_state = load_pca_state_from_hf()

# Load reference audio
speaker_audio = load_audio("reference.wav").cuda()

# Configure sampler
sample_fn = partial(
    sample_euler_cfg_independent_guidances,
    num_steps=40,
    cfg_scale_text=3.0,
    cfg_scale_speaker=8.0,
    sequence_length=640,  # 30 seconds max
)

# Generate
text = "Hello, this is a test of the Echo TTS model."
audio_out, _ = sample_pipeline(
    model=model,
    fish_ae=fish_ae,
    pca_state=pca_state,
    sample_fn=sample_fn,
    text_prompt=text,
    speaker_audio=speaker_audio,
    rng_seed=0,
)

torchaudio.save("output.wav", audio_out[0].cpu(), 44100)
```

---

## ⚠️ License Warning

> [!CAUTION]
> Echo-TTS uses Fish-Speech S1-DAC which is licensed **CC BY-NC-SA 4.0**.  
> This means **non-commercial use only**.  
> Commercial use requires licensing alternative components.

---

## Links

- **GitHub**: https://github.com/jordandare/echo-tts
- **HuggingFace Model**: https://huggingface.co/jordand/echo-tts-base
- **Demo**: https://huggingface.co/spaces/jordand/echo-tts-preview
- **Blog Post**: https://jordandarefsky.com/blog/2025/echo/

---

## 🔮 Future Research Required

**Chunking & Long Form Audio**
Implementing proper text chunking and sequential generation requires deep investigation into:
- Sentence boundary detection that aligns with model's pause behavior.
- Maintaining speaker state across chunks (does `pca_state` or `speaker_audio` need adjustment?).
- Crossfading techniques to prevent clicks at boundaries.

**Voice Settings**
Fine-tuning `cfg_scale_text` and `cfg_scale_speaker` requires empirical testing to determine:
- Safe ranges for "Emotion" vs "Stability".
- Impact on inference speed.
- Interaction with different voice types (deep vs high pitch).
