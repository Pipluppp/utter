# Step 2: Image Building

> **Time Required**: ~5 minutes (code), ~10 minutes (build)
> **Prerequisites**: Completed [Step 1: Prerequisites](./01-prerequisites.md)

This guide explains how to build the Modal container image with all required dependencies.

---

## 2.1 Understanding the Dependencies

### System Packages (apt)

From the [Qwen3-TTS pyproject.toml](https://github.com/QwenLM/Qwen3-TTS/blob/main/pyproject.toml):

| Package | Purpose |
|---------|---------|
| `sox` | Audio format conversion |
| `libsox-fmt-all` | SOX format plugins |
| `libsndfile1` | Required by `soundfile` Python package |
| `ffmpeg` | Audio/video processing |

### Python Packages

| Package | Version | Notes |
|---------|---------|-------|
| `qwen-tts` | Latest | Installs `transformers==4.57.3`, `accelerate==1.12.0` |
| `fastapi[standard]` | Latest | Web framework for API |
| `soundfile` | Latest | Audio file I/O |
| `torchaudio` | Latest | PyTorch audio utilities |

### Attention Implementation

**Key Decision**: We do NOT install `flash-attn` by default because:
1. It requires C++ compilation which can fail on Modal
2. PyTorch's native SDPA provides similar performance
3. The code automatically falls back to SDPA or eager

---

## 2.2 Create the Image Builder

Add this code to the top of your `app.py`:

```python
"""
Qwen3-TTS Voice Cloning API on Modal.com

Sources:
- Modal image guide: https://modal.com/docs/guide/images
- Modal CUDA guide: https://modal.com/docs/guide/cuda
- Qwen3-TTS requirements: https://github.com/QwenLM/Qwen3-TTS
"""

import modal

# =============================================================================
# Image Configuration
# =============================================================================

# Volume mount path (must match config.py)
MODELS_DIR = "/vol/models"
HF_CACHE_DIR = f"{MODELS_DIR}/huggingface"


def create_image() -> modal.Image:
    """
    Build Modal container image for Qwen3-TTS.

    This function creates an image with:
    - Python 3.12 (recommended by Qwen3-TTS)
    - System audio libraries (sox, ffmpeg)
    - qwen-tts package with pinned transformers
    - FastAPI for web endpoints

    Sources:
    - Python version: Qwen3-TTS README recommends 3.12
    - System deps: Qwen3-TTS pyproject.toml
    - Image building: https://modal.com/docs/guide/images
    """

    # Start with debian_slim base + Python 3.12
    # Source: Qwen3-TTS GitHub README
    # "conda create -n qwen3-tts python=3.12"
    image = modal.Image.debian_slim(python_version="3.12")

    # Install system dependencies
    # Source: Qwen3-TTS pyproject.toml lists sox, soundfile
    image = image.apt_install(
        "sox",              # Required by sox Python package
        "libsox-fmt-all",   # SOX format support (mp3, flac, etc.)
        "libsndfile1",      # Required by soundfile package
        "ffmpeg",           # Audio format conversion
    )

    # Set environment variables for HuggingFace cache
    # Source: Modal volumes guide - HF_HOME respected by huggingface_hub
    image = image.env({
        "HF_HOME": HF_CACHE_DIR,
        "TRANSFORMERS_CACHE": HF_CACHE_DIR,
        "HF_HUB_CACHE": HF_CACHE_DIR,
        "TOKENIZERS_PARALLELISM": "false",  # Avoid tokenizer warnings
    })

    # Install Python packages
    # Source: Qwen3-TTS pyproject.toml
    # Note: qwen-tts will install transformers==4.57.3, accelerate==1.12.0
    image = image.pip_install(
        # Core TTS package
        "qwen-tts",

        # Web framework (from Modal Chatterbox example)
        "fastapi[standard]",

        # Audio processing
        "soundfile",
        "torchaudio",

        # Ensure numpy compatibility
        "numpy<2.0",
    )

    return image


# Build the image
image = create_image()
```

---

## 2.3 Alternative: CUDA Base Image (for Flash Attention)

If you need Flash Attention 2 for maximum performance, use this alternative image builder:

```python
def create_cuda_image() -> modal.Image:
    """
    Build image from NVIDIA CUDA base for Flash Attention support.

    Use this if:
    - You need maximum attention performance
    - You're willing to accept longer build times

    Sources:
    - Modal CUDA guide: https://modal.com/docs/guide/cuda
    - "use officially-supported CUDA images from Docker Hub"
    """

    # Use CUDA 12.4 devel image (includes nvcc compiler)
    # Source: Modal CUDA guide recommends nvidia/cuda:*-devel-* variants
    image = modal.Image.from_registry(
        "nvidia/cuda:12.4.1-devel-ubuntu22.04",
        add_python="3.12",
    )

    # System dependencies
    image = image.apt_install(
        "sox",
        "libsox-fmt-all",
        "libsndfile1",
        "ffmpeg",
        "git",  # Needed for some pip installs
    )

    # Environment variables
    image = image.env({
        "HF_HOME": HF_CACHE_DIR,
        "TRANSFORMERS_CACHE": HF_CACHE_DIR,
        "HF_HUB_CACHE": HF_CACHE_DIR,
        "TOKENIZERS_PARALLELISM": "false",
    })

    # Install PyTorch with CUDA 12.4 support
    image = image.pip_install(
        "torch",
        "torchaudio",
        index_url="https://download.pytorch.org/whl/cu124",
    )

    # Install Flash Attention (requires CUDA compilation)
    # Source: Qwen3-TTS README
    # "pip install -U flash-attn --no-build-isolation"
    # WARNING: This adds significant build time
    image = image.run_commands(
        "pip install flash-attn --no-build-isolation",
        gpu="T4",  # Compile with GPU for CUDA kernels
    )

    # Install remaining packages
    image = image.pip_install(
        "qwen-tts",
        "fastapi[standard]",
        "soundfile",
        "numpy<2.0",
    )

    return image


# Uncomment to use CUDA image with Flash Attention:
# image = create_cuda_image()
```

---

## 2.4 Test the Image Build

Create a simple test to verify the image builds correctly:

```python
# Add to app.py temporarily for testing

app = modal.App("qwen3-tts-image-test", image=image)


@app.function()
def test_imports():
    """Test that all required packages are importable."""
    import torch
    import torchaudio
    import soundfile
    from fastapi import FastAPI

    # Test qwen_tts import
    from qwen_tts import Qwen3TTSModel

    return {
        "torch_version": torch.__version__,
        "cuda_available": torch.cuda.is_available(),
        "torchaudio_version": torchaudio.__version__,
        "qwen_tts": "importable",
    }


@app.local_entrypoint()
def main():
    result = test_imports.remote()
    print("Import test results:")
    for key, value in result.items():
        print(f"  {key}: {value}")
```

Run the test:

```bash
modal run app.py
```

**Expected output:**

```
Import test results:
  torch_version: 2.x.x
  cuda_available: True
  torchaudio_version: 2.x.x
  qwen_tts: importable
```

---

## 2.5 Understanding Image Layers

Modal builds images incrementally. Each method call creates a layer:

```
Layer 1: debian_slim(python_version="3.12")
    ↓
Layer 2: apt_install(sox, libsndfile1, ffmpeg)
    ↓
Layer 3: env(HF_HOME=..., TRANSFORMERS_CACHE=...)
    ↓
Layer 4: pip_install(qwen-tts, fastapi, soundfile, torchaudio)
```

**Tip**: Order your layers from least-changing to most-changing. Put `apt_install` before `pip_install` since system packages change less frequently.

---

## 2.6 Clean Up Test Code

After verifying the image builds, remove the test code:

1. Remove the `test_imports` function
2. Remove the test `@app.local_entrypoint()`
3. Keep only the `image = create_image()` line

Your `app.py` should now contain only the image builder code from section 2.2.

---

## Checklist

Before proceeding, confirm:

- [ ] `app.py` contains the `create_image()` function
- [ ] `image = create_image()` is defined at module level
- [ ] Test run with `modal run app.py` succeeds
- [ ] All imports work (torch, qwen_tts, soundfile, fastapi)

---

## Troubleshooting

### Issue: pip install fails for qwen-tts

**Symptom**: Dependency resolution error

**Solution**: The `qwen-tts` package pins exact versions. Ensure you're not mixing with other packages that require different transformers versions.

### Issue: CUDA not available

**Symptom**: `cuda_available: False`

**Solution**: This is expected in the test function if no GPU is attached. GPUs are attached via `@app.function(gpu="T4")`.

### Issue: soundfile import error

**Symptom**: `OSError: libsndfile.so not found`

**Solution**: Ensure `libsndfile1` is in the `apt_install` list.

---

## Next Step

Proceed to [Step 3: Model Caching](./03-model-caching.md)
