# Step 4: Core Service Implementation

> **Time Required**: ~15 minutes
> **Prerequisites**: Completed [Step 3: Model Caching](./03-model-caching.md)

This guide implements the core Qwen3-TTS service class with model loading and voice generation.

---

## 4.1 Understanding the Service Pattern

Modal uses a class-based pattern for stateful services:

```
Container Start
    ↓
@modal.enter() → Load model once
    ↓
@modal.method() → Handle requests (reuses loaded model)
    ↓
Container Shutdown
```

This ensures the model is loaded only once per container, not per request.

**Source**: [Modal Lifecycle Functions](https://modal.com/docs/guide/lifecycle-functions)

---

## 4.2 Attention Implementation Strategy

The code automatically selects the best available attention implementation:

```python
def get_attention_implementation() -> str:
    """
    Determine the best available attention implementation.

    Priority:
    1. flash_attention_2 - Fastest, requires flash-attn package
    2. sdpa - PyTorch native, good performance
    3. eager - Guaranteed compatibility, slowest

    Sources:
    - Qwen3-TTS uses attn_implementation parameter
    - PyTorch SDPA: torch.nn.functional.scaled_dot_product_attention
    """
    import importlib.util

    # Priority 1: Flash Attention 2
    if importlib.util.find_spec("flash_attn") is not None:
        try:
            import flash_attn
            return "flash_attention_2"
        except ImportError:
            pass

    # Priority 2: SDPA (PyTorch >= 2.0)
    import torch
    if hasattr(torch.nn.functional, "scaled_dot_product_attention"):
        return "sdpa"

    # Priority 3: Eager (fallback)
    return "eager"
```

---

## 4.3 Complete Service Implementation

Update your `app.py` with the complete service class:

```python
"""
Qwen3-TTS Voice Cloning API on Modal.com

Sources:
- Modal Chatterbox example: https://modal.com/docs/examples/chatterbox_tts
- Qwen3-TTS GitHub: https://github.com/QwenLM/Qwen3-TTS
- Qwen3-TTS HuggingFace: https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base
"""

import io
import os
from typing import Optional

import modal

# =============================================================================
# Configuration
# =============================================================================

# Model selection - change this to switch between models
MODEL_ID = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"
MODEL_NAME = MODEL_ID.split("/")[-1]  # "Qwen3-TTS-12Hz-1.7B-Base"

# Volume configuration
MODELS_DIR = "/vol/models"
HF_CACHE_DIR = f"{MODELS_DIR}/huggingface"

# GPU selection based on model size
# Source: Investigation report - 1.7B needs ~5-6GB VRAM
GPU_TYPE = "A10G" if "1.7B" in MODEL_ID else "T4"

# Container settings
# Source: Modal Chatterbox example
CONTAINER_IDLE_TIMEOUT = 300  # 5 minutes
MAX_CONCURRENT_INPUTS = 10

# Supported languages
# Source: Qwen3-TTS model card
SUPPORTED_LANGUAGES = [
    "Auto", "Chinese", "English", "Japanese", "Korean",
    "German", "French", "Russian", "Portuguese", "Spanish", "Italian"
]

# =============================================================================
# Image Definition
# =============================================================================

def create_image() -> modal.Image:
    """Build container image with all dependencies."""
    image = modal.Image.debian_slim(python_version="3.12")

    image = image.apt_install(
        "sox",
        "libsox-fmt-all",
        "libsndfile1",
        "ffmpeg",
    )

    image = image.env({
        "HF_HOME": HF_CACHE_DIR,
        "TRANSFORMERS_CACHE": HF_CACHE_DIR,
        "HF_HUB_CACHE": HF_CACHE_DIR,
        "TOKENIZERS_PARALLELISM": "false",
    })

    image = image.pip_install(
        "qwen-tts",
        "fastapi[standard]",
        "soundfile",
        "torchaudio",
        "numpy<2.0",
    )

    return image


image = create_image()

# =============================================================================
# Modal App & Volume
# =============================================================================

app = modal.App("qwen3-tts-voice-clone", image=image)

models_volume = modal.Volume.from_name(
    "qwen3-tts-models",
    create_if_missing=True
)

# =============================================================================
# Service Class
# =============================================================================

@app.cls(
    gpu=GPU_TYPE,
    scaledown_window=CONTAINER_IDLE_TIMEOUT,
    volumes={MODELS_DIR: models_volume},
    secrets=[modal.Secret.from_name("huggingface-secret")],
    timeout=300,  # 5 minute request timeout
)
@modal.concurrent(max_inputs=MAX_CONCURRENT_INPUTS)
class Qwen3TTSService:
    """
    Voice cloning service using Qwen3-TTS.

    This class handles:
    - Model loading at container start
    - Voice clone generation
    - Reusable voice prompt creation

    Sources:
    - Modal @app.cls pattern: https://modal.com/docs/guide/lifecycle-functions
    - Qwen3-TTS API: https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base
    """

    @modal.enter()
    def load_model(self):
        """
        Load model when container starts.

        This method runs once per container, not per request.
        The model stays in GPU memory for subsequent requests.

        Source: Modal docs - "@modal.enter() executes when a container starts"
        """
        import torch
        from qwen_tts import Qwen3TTSModel

        print("=" * 60)
        print(f"Loading Qwen3-TTS Model: {MODEL_NAME}")
        print("=" * 60)

        # Log GPU information
        print(f"CUDA available: {torch.cuda.is_available()}")
        if torch.cuda.is_available():
            print(f"GPU: {torch.cuda.get_device_name(0)}")
            gpu_mem = torch.cuda.get_device_properties(0).total_memory / 1e9
            print(f"GPU Memory: {gpu_mem:.1f} GB")

        # Determine attention implementation
        self.attn_impl = self._get_attention_implementation()
        print(f"Attention implementation: {self.attn_impl}")

        # Check for cached model in volume
        local_model_path = f"{MODELS_DIR}/{MODEL_NAME}"
        if os.path.exists(local_model_path) and os.listdir(local_model_path):
            print(f"Loading from volume: {local_model_path}")
            load_path = local_model_path
        else:
            print(f"Loading from HuggingFace Hub: {MODEL_ID}")
            print("WARNING: This will be slow. Run download_models.py first!")
            load_path = MODEL_ID

        # Load model
        # Source: Qwen3-TTS HuggingFace model card
        self.model = Qwen3TTSModel.from_pretrained(
            load_path,
            device_map="cuda:0",
            dtype=torch.bfloat16,
            attn_implementation=self.attn_impl,
        )

        print("Model loaded successfully!")
        print("=" * 60)

    def _get_attention_implementation(self) -> str:
        """Determine best available attention implementation."""
        import importlib.util

        # Try Flash Attention 2
        if importlib.util.find_spec("flash_attn") is not None:
            try:
                import flash_attn
                print(f"Flash Attention found: v{flash_attn.__version__}")
                return "flash_attention_2"
            except ImportError:
                pass

        # Try SDPA (PyTorch native)
        import torch
        if hasattr(torch.nn.functional, "scaled_dot_product_attention"):
            print("Using PyTorch native SDPA")
            return "sdpa"

        # Fallback to eager
        print("Using eager attention (fallback)")
        return "eager"

    @modal.method()
    def generate_voice_clone(
        self,
        text: str,
        language: str,
        ref_audio: str,
        ref_text: str,
        max_new_tokens: int = 2048,
    ) -> bytes:
        """
        Generate cloned voice audio from text.

        Args:
            text: Text to synthesize
            language: Target language (e.g., "English", "Chinese", "Auto")
            ref_audio: Reference audio (URL or base64 string)
            ref_text: Transcript of reference audio
            max_new_tokens: Maximum tokens to generate

        Returns:
            WAV audio bytes

        Source: Qwen3-TTS HuggingFace model card - generate_voice_clone()
        """
        import soundfile as sf

        print(f"Generating voice clone:")
        print(f"  Text: '{text[:50]}{'...' if len(text) > 50 else ''}'")
        print(f"  Language: {language}")
        print(f"  Ref text: '{ref_text[:50]}{'...' if len(ref_text) > 50 else ''}'")

        # Generate audio
        # Source: Qwen3-TTS model card code example
        wavs, sr = self.model.generate_voice_clone(
            text=text,
            language=language,
            ref_audio=ref_audio,
            ref_text=ref_text,
            max_new_tokens=max_new_tokens,
        )

        print(f"  Generated: {len(wavs[0])} samples at {sr} Hz")

        # Convert to WAV bytes
        # Source: Modal Chatterbox example - BytesIO pattern
        buffer = io.BytesIO()
        sf.write(buffer, wavs[0], sr, format="WAV", subtype="PCM_16")
        buffer.seek(0)

        audio_bytes = buffer.read()
        print(f"  Output size: {len(audio_bytes)} bytes")

        return audio_bytes

    @modal.method()
    def generate_voice_clone_batch(
        self,
        texts: list[str],
        languages: list[str],
        ref_audio: str,
        ref_text: str,
        max_new_tokens: int = 2048,
    ) -> list[bytes]:
        """
        Generate multiple voice clones in a batch.

        More efficient than calling generate_voice_clone multiple times
        because the voice prompt is computed once.

        Args:
            texts: List of texts to synthesize
            languages: List of languages (same length as texts)
            ref_audio: Reference audio (shared for all)
            ref_text: Reference transcript (shared for all)
            max_new_tokens: Maximum tokens per generation

        Returns:
            List of WAV audio bytes

        Source: Qwen3-TTS model card - batch generation pattern
        """
        import soundfile as sf

        print(f"Batch generation: {len(texts)} items")

        # Create reusable voice prompt
        # Source: Qwen3-TTS model card - create_voice_clone_prompt()
        voice_prompt = self.model.create_voice_clone_prompt(
            ref_audio=ref_audio,
            ref_text=ref_text,
            x_vector_only_mode=False,
        )

        # Generate all at once
        wavs, sr = self.model.generate_voice_clone(
            text=texts,
            language=languages,
            voice_clone_prompt=voice_prompt,
            max_new_tokens=max_new_tokens,
        )

        # Convert each to WAV bytes
        results = []
        for i, wav in enumerate(wavs):
            buffer = io.BytesIO()
            sf.write(buffer, wav, sr, format="WAV", subtype="PCM_16")
            buffer.seek(0)
            results.append(buffer.read())
            print(f"  [{i+1}/{len(texts)}] {len(results[-1])} bytes")

        return results

    @modal.method()
    def create_voice_prompt(
        self,
        ref_audio: str,
        ref_text: str,
    ) -> dict:
        """
        Create a reusable voice clone prompt.

        This is useful for generating multiple utterances with the same voice.
        The prompt can be cached and reused.

        Args:
            ref_audio: Reference audio (URL or base64)
            ref_text: Transcript of reference audio

        Returns:
            Status dict (prompt object is not directly serializable)

        Source: Qwen3-TTS model card - create_voice_clone_prompt()
        """
        print(f"Creating voice prompt from reference")

        prompt_items = self.model.create_voice_clone_prompt(
            ref_audio=ref_audio,
            ref_text=ref_text,
            x_vector_only_mode=False,
        )

        # Note: The prompt object contains tensors and isn't JSON serializable
        # In production, you might want to store this in a cache
        return {
            "status": "created",
            "ref_text_length": len(ref_text),
        }

    @modal.method()
    def get_model_info(self) -> dict:
        """
        Get information about the loaded model.

        Returns:
            Dict with model information
        """
        import torch

        return {
            "model_id": MODEL_ID,
            "model_name": MODEL_NAME,
            "attention_implementation": self.attn_impl,
            "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "none",
            "gpu_memory_gb": torch.cuda.get_device_properties(0).total_memory / 1e9 if torch.cuda.is_available() else 0,
            "supported_languages": SUPPORTED_LANGUAGES,
        }
```

---

## 4.4 Testing the Service

Add a test entrypoint to verify the service works:

```python
# Add to the end of app.py

@app.local_entrypoint()
def main():
    """
    Test the service locally.

    Usage:
        modal run app.py
    """
    print("Testing Qwen3-TTS Service")
    print("=" * 60)

    # Reference audio from Qwen documentation
    # Source: Qwen3-TTS HuggingFace model card examples
    ref_audio = "https://qianwen-res.oss-cn-beijing.aliyuncs.com/Qwen3-TTS-Repo/clone.wav"
    ref_text = (
        "Okay. Yeah. I resent you. I love you. I respect you. "
        "But you know what? You blew it! And thanks to you."
    )

    test_text = "Hello, this is a test of the Qwen3 text to speech voice cloning system."

    # Create service instance
    service = Qwen3TTSService()

    # Test model info
    print("\n1. Testing model info...")
    info = service.get_model_info.remote()
    print(f"   Model: {info['model_name']}")
    print(f"   Attention: {info['attention_implementation']}")
    print(f"   GPU: {info['gpu']}")

    # Test voice cloning
    print("\n2. Testing voice clone generation...")
    audio_bytes = service.generate_voice_clone.remote(
        text=test_text,
        language="English",
        ref_audio=ref_audio,
        ref_text=ref_text,
    )

    # Save output
    output_path = "test_output.wav"
    with open(output_path, "wb") as f:
        f.write(audio_bytes)

    print(f"   Saved: {output_path} ({len(audio_bytes)} bytes)")
    print("\nTest complete!")
```

Run the test:

```bash
modal run app.py
```

**Expected output:**

```
Testing Qwen3-TTS Service
============================================================

1. Testing model info...
   Model: Qwen3-TTS-12Hz-1.7B-Base
   Attention: sdpa
   GPU: NVIDIA A10G

2. Testing voice clone generation...
   Saved: test_output.wav (234567 bytes)

Test complete!
```

---

## 4.5 Key Implementation Details

### Model Loading Path Resolution

```python
# First check: Volume-cached model
local_model_path = f"{MODELS_DIR}/{MODEL_NAME}"  # /vol/models/Qwen3-TTS-12Hz-1.7B-Base

if os.path.exists(local_model_path):
    load_path = local_model_path  # Fast: load from volume
else:
    load_path = MODEL_ID  # Slow: download from HuggingFace
```

### Attention Implementation Selection

The code tries attention implementations in order:
1. `flash_attention_2` - Check if `flash_attn` package is installed
2. `sdpa` - Check if PyTorch has `scaled_dot_product_attention`
3. `eager` - Always available (fallback)

### Batch Generation Efficiency

For multiple texts with the same voice:
1. Call `create_voice_clone_prompt()` once
2. Pass `voice_clone_prompt` to `generate_voice_clone()`
3. This avoids re-processing the reference audio

---

## 4.6 Switching Models

To switch between 1.7B and 0.6B models:

```python
# For 1.7B (higher quality)
MODEL_ID = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"

# For 0.6B (faster, lower memory)
MODEL_ID = "Qwen/Qwen3-TTS-12Hz-0.6B-Base"
```

The GPU type is automatically selected based on the model size.

---

## Checklist

Before proceeding, confirm:

- [ ] `app.py` contains the complete service class
- [ ] `@modal.enter()` method loads the model
- [ ] `@modal.method()` decorates the generation methods
- [ ] Test run with `modal run app.py` succeeds
- [ ] `test_output.wav` is generated and playable

---

## Next Step

Proceed to [Step 5: API Endpoints](./05-api-endpoints.md)
