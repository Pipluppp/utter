# Step 1: Prerequisites & Setup

> **Time Required**: ~10 minutes
> **Prerequisites**: Python 3.9+, pip, Terminal access
> **Last Updated**: 2026-01-27

This guide walks through setting up your Modal.com account, CLI, secrets, and volumes.

---

## Completion Status (2026-01-27)

| Step | Status | Notes |
|------|--------|-------|
| Modal CLI | Complete | Using `uv run modal` |
| Modal Authentication | Complete | Workspace: `duncab013` |
| HuggingFace Secret | Complete | `huggingface-secret` |
| Modal Volume | Complete | `qwen3-tts-models` |

All prerequisites are complete. Proceed to [Step 2: Image Building](./02-image-building.md).

---

## Note: This Project Uses uv

This project uses `uv` for Python package management. Prefix all modal commands with `uv run`:

```bash
# Instead of: modal deploy app.py
# Use:
uv run modal deploy app.py
```

---

## 1.1 Install Modal CLI

Open your terminal and install the Modal Python package:

```bash
pip install modal
```

**Verify installation:**

```bash
modal --version
```

Expected output: `modal, version X.X.X`

---

## 1.2 Authenticate with Modal

Create a Modal account at [modal.com](https://modal.com) if you haven't already, then authenticate:

```bash
modal token new
```

This opens a browser window for authentication. After successful auth, verify:

```bash
modal profile current
```

Expected output shows your workspace name.

---

## 1.3 Create HuggingFace Secret

The Qwen3-TTS models require a HuggingFace token for download.

### 1.3.1 Get Your HuggingFace Token

1. Go to [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
2. Click "New token"
3. Name it `modal-qwen3-tts`
4. Select "Read" access
5. Copy the token (starts with `hf_`)

### 1.3.2 Create Modal Secret

**Option A: Via CLI (Recommended)**

```bash
modal secret create huggingface-secret HF_TOKEN=hf_your_actual_token_here
```

**Option B: Via Dashboard**

1. Go to [modal.com/secrets](https://modal.com/secrets)
2. Click "New Secret"
3. Select "Hugging Face" template
4. Enter your token in the `HF_TOKEN` field
5. Name it `huggingface-secret`
6. Click "Create"

### 1.3.3 Verify Secret Creation

```bash
modal secret list
```

You should see `huggingface-secret` in the list.

---

## 1.4 Create Model Cache Volume

Create a persistent volume to store model weights:

```bash
modal volume create qwen3-tts-models
```

**Verify creation:**

```bash
modal volume list
```

Expected output includes `qwen3-tts-models`.

---

## 1.5 Create Project Directory

Create your project structure:

```bash
mkdir qwen3-tts-modal
cd qwen3-tts-modal
```

Create the initial files:

```bash
touch app.py config.py download_models.py test_client.py
```

Your directory structure should be:

```
qwen3-tts-modal/
├── app.py
├── config.py
├── download_models.py
└── test_client.py
```

---

## 1.6 Create Configuration File

Create `config.py` with the following content:

```python
"""
Configuration constants for Qwen3-TTS Modal deployment.

Sources:
- Model IDs: https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base
- Languages: Qwen3-TTS model card
"""

# =============================================================================
# Model Configuration
# =============================================================================

# Available models (from HuggingFace)
MODEL_1_7B = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"
MODEL_0_6B = "Qwen/Qwen3-TTS-12Hz-0.6B-Base"

# Select which model to deploy (change this to switch models)
DEFAULT_MODEL = MODEL_1_7B

# =============================================================================
# Modal Volume Configuration
# =============================================================================

# Volume mount path inside container
MODELS_DIR = "/vol/models"

# HuggingFace cache path (must be on the volume)
HF_HOME_PATH = "/vol/models/huggingface"

# =============================================================================
# Audio Configuration
# =============================================================================

# Default generation settings (from Qwen3-TTS generate_config.json)
DEFAULT_SAMPLE_RATE = 24000
MAX_NEW_TOKENS = 2048

# =============================================================================
# Supported Languages
# =============================================================================

# From Qwen3-TTS model card
SUPPORTED_LANGUAGES = [
    "Auto",      # Auto-detect language
    "Chinese",
    "English",
    "Japanese",
    "Korean",
    "German",
    "French",
    "Russian",
    "Portuguese",
    "Spanish",
    "Italian",
]

# =============================================================================
# GPU Configuration
# =============================================================================

# GPU selection based on model size
# Source: Investigation report VRAM analysis
# - 0.6B needs ~2-3 GB VRAM
# - 1.7B needs ~5-6 GB VRAM
GPU_CONFIG = {
    "0.6B": "T4",      # 16GB VRAM - sufficient
    "1.7B": "A10G",    # 24GB VRAM - comfortable headroom
}

# =============================================================================
# Container Settings
# =============================================================================

# How long to keep container warm after last request
# Source: Modal Chatterbox example uses 300 (5 minutes)
CONTAINER_IDLE_TIMEOUT = 300

# Maximum concurrent requests per container
# Source: Modal Chatterbox example uses 10
MAX_CONCURRENT_INPUTS = 10

# Request timeout (for long text generation)
REQUEST_TIMEOUT = 300  # 5 minutes
```

---

## 1.7 Verify Setup

Run this verification script to ensure everything is configured:

```bash
# Check Modal CLI
modal --version

# Check authentication
modal profile current

# Check secret exists
modal secret list | grep huggingface-secret

# Check volume exists
modal volume list | grep qwen3-tts-models
```

All commands should succeed without errors.

---

## Checklist

Before proceeding to the next step, confirm:

- [ ] Modal CLI installed (`modal --version` works)
- [ ] Authenticated with Modal (`modal profile current` shows workspace)
- [ ] HuggingFace secret created (`huggingface-secret`)
- [ ] Model volume created (`qwen3-tts-models`)
- [ ] Project directory created with `config.py`

---

## Next Step

Proceed to [Step 2: Image Building](./02-image-building.md)
