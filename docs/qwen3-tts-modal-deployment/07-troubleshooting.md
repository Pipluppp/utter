# Step 7: Troubleshooting

> **Reference Guide**: Use this when encountering issues
> **Last Updated**: 2026-01-27

This guide covers common issues and their solutions when deploying Qwen3-TTS on Modal.

---

## Issues Encountered During Actual Deployment (2026-01-27)

These issues were encountered and resolved during the initial deployment:

### Windows Unicode Encoding Error

**Symptom:**
```
'charmap' codec can't encode character '\u2713' in position 0
```

**Cause:** Modal CLI outputs Unicode checkmarks (✓) which Windows cmd.exe can't display.

**Solution:** Pipe output through `cat`:
```bash
uv run modal deploy app.py 2>&1 | cat
```

---

### FastAPI Import Error

**Symptom:**
```
ModuleNotFoundError: No module named 'fastapi'
```

**Cause:** Modal parses the Python file locally before deploying. Top-level FastAPI imports fail because FastAPI isn't installed locally.

**Solution:** Use lazy imports inside methods:
```python
# BAD
from fastapi import HTTPException

# GOOD - import inside methods
def clone(self, request: dict):
    from fastapi import HTTPException
    # ...
```

---

### Reference Audio URL Returns 403

**Symptom:**
```
{"detail":"Generation failed: HTTP Error 403: Forbidden"}
```

**Cause:** The Qwen sample audio URL from Alibaba Cloud OSS is blocked or region-restricted.

**Solution:** Use base64-encoded audio instead of URLs:
```python
import base64
with open('audio.wav', 'rb') as f:
    audio_b64 = base64.b64encode(f.read()).decode()
# Use ref_audio_base64 instead of ref_audio_url
```

---

### "File name too long" Error

**Symptom:**
```
[Errno 36] File name too long: 'UklGRsy6BgBXQVZFZm10...'
```

**Cause:** qwen-tts library treats ref_audio as a file path. Base64 strings are too long to be file paths.

**Solution:** Decode base64 and save to temp file before passing to model. This is now implemented in `_resolve_ref_audio()` method.

---

### Container Uses Old Code After Redeploy

**Symptom:** Code changes don't take effect after `modal deploy`.

**Cause:** Modal containers are cached and may not restart immediately.

**Solution:** Stop the app before redeploying:
```bash
uv run modal app stop qwen3-tts-voice-clone
uv run modal deploy app.py 2>&1 | cat
```

---

## Quick Diagnostics

Run these commands to gather diagnostic information:

```bash
# Check Modal CLI version
uv run modal --version

# Check authentication
uv run modal profile current

# Check app status
uv run modal app list

# View recent logs (pipe through cat on Windows)
uv run modal app logs qwen3-tts-voice-clone 2>&1 | cat

# Check volume contents
uv run modal volume ls qwen3-tts-models

# Test health endpoint
curl https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-health.modal.run
```

---

## Issue Categories

1. [Build & Image Issues](#1-build--image-issues)
2. [Model Loading Issues](#2-model-loading-issues)
3. [Runtime & Generation Issues](#3-runtime--generation-issues)
4. [Network & Endpoint Issues](#4-network--endpoint-issues)
5. [Performance Issues](#5-performance-issues)

---

## 1. Build & Image Issues

### 1.1 Flash Attention Compilation Fails

**Symptom:**
```
error: command 'gcc' failed with exit code 1
fatal error: cuda_runtime.h: No such file or directory
```

**Cause:** Flash Attention requires CUDA development tools to compile.

**Solution:** Don't install flash-attn. The code automatically falls back to SDPA.

```python
# In create_image(), ensure flash-attn is NOT included:
image = image.pip_install(
    "qwen-tts",
    "fastapi[standard]",
    "soundfile",
    "torchaudio",
    # Do NOT add "flash-attn"
)
```

The service will use PyTorch's native SDPA, which provides similar performance.

---

### 1.2 pip Dependency Resolution Error

**Symptom:**
```
ERROR: pip's dependency resolver does not currently consider all packages
ERROR: Cannot install qwen-tts because these package versions have conflicting dependencies
```

**Cause:** Version conflicts with other packages.

**Solution:** The `qwen-tts` package requires exact versions:
- `transformers==4.57.3`
- `accelerate==1.12.0`

Create a dedicated Modal app to avoid conflicts:

```python
# Use a unique app name
app = modal.App("qwen3-tts-isolated", image=image)
```

Or pin compatible versions explicitly:

```python
image = image.pip_install(
    "transformers==4.57.3",
    "accelerate==1.12.0",
    "qwen-tts",
    # other packages
)
```

---

### 1.3 libsndfile Not Found

**Symptom:**
```
OSError: cannot load library 'libsndfile.so': libsndfile.so: cannot open shared object file
```

**Cause:** System library not installed.

**Solution:** Ensure `libsndfile1` is in apt_install:

```python
image = image.apt_install(
    "sox",
    "libsox-fmt-all",
    "libsndfile1",  # Required for soundfile package
    "ffmpeg",
)
```

---

### 1.4 sox Command Not Found

**Symptom:**
```
FileNotFoundError: [Errno 2] No such file or directory: 'sox'
```

**Cause:** SOX not installed in container.

**Solution:** Add both `sox` and format libraries:

```python
image = image.apt_install(
    "sox",           # Main sox binary
    "libsox-fmt-all", # Format support (mp3, flac, etc.)
)
```

---

## 2. Model Loading Issues

### 2.1 Model Not Found in Volume

**Symptom:**
```
OSError: Qwen/Qwen3-TTS-12Hz-1.7B-Base does not appear to have a file named config.json
```

**Cause:** Model not pre-downloaded to volume.

**Solution:** Run the download script:

```bash
# Download models to volume
modal run download_models.py --model-size 1.7B

# Verify download
modal volume ls qwen3-tts-models
```

You should see:
```
Qwen3-TTS-12Hz-1.7B-Base/
├── config.json
├── model.safetensors
└── ...
```

---

### 2.2 HuggingFace Authentication Error

**Symptom:**
```
huggingface_hub.utils._errors.RepositoryNotFoundError: 401 Client Error
```

**Cause:** Invalid or missing HuggingFace token.

**Solution:**

1. Verify your token at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)

2. Update the Modal secret:
```bash
modal secret delete huggingface-secret
modal secret create huggingface-secret HF_TOKEN=hf_your_new_token
```

3. Ensure the secret is attached to the function:
```python
@app.cls(
    secrets=[modal.Secret.from_name("huggingface-secret")],
    # ...
)
```

---

### 2.3 CUDA Out of Memory

**Symptom:**
```
torch.cuda.OutOfMemoryError: CUDA out of memory. Tried to allocate X GiB
```

**Cause:** GPU doesn't have enough VRAM.

**Solutions:**

1. **Use smaller model:**
```python
MODEL_ID = "Qwen/Qwen3-TTS-12Hz-0.6B-Base"  # ~2-3GB VRAM
```

2. **Use larger GPU:**
```python
GPU_TYPE = "A10G"  # 24GB VRAM
# or
GPU_TYPE = "A100-40GB"  # 40GB VRAM
```

3. **Reduce batch size** (for batch endpoint):
```python
class BatchVoiceCloneRequest(BaseModel):
    texts: list[str] = Field(..., max_length=5)  # Reduce from 10
```

---

### 2.4 Model Loading Timeout

**Symptom:**
```
TimeoutError: Function timed out after 120 seconds
```

**Cause:** Model download takes too long during cold start.

**Solution:**

1. Pre-download models to volume (see 2.1)

2. Increase function timeout:
```python
@app.cls(
    timeout=600,  # 10 minutes
    # ...
)
```

---

### 2.5 Attention Implementation Not Supported

**Symptom:**
```
ValueError: Qwen3TTSModel does not support attention implementation 'sdpa'
```

**Cause:** Model might not support the selected attention backend.

**Solution:** Force eager attention:

```python
def _get_attention_implementation(self) -> str:
    # Skip SDPA check, go straight to eager
    return "eager"
```

Or try with explicit fallback:

```python
try:
    self.model = Qwen3TTSModel.from_pretrained(
        load_path,
        attn_implementation="sdpa",
        # ...
    )
except Exception:
    self.model = Qwen3TTSModel.from_pretrained(
        load_path,
        attn_implementation="eager",
        # ...
    )
```

---

## 3. Runtime & Generation Issues

### 3.1 Empty or Silent Audio Output

**Symptom:** Generated WAV file is silent or very short.

**Cause:** Generation parameters or reference audio issues.

**Solutions:**

1. **Increase max_new_tokens:**
```python
wavs, sr = self.model.generate_voice_clone(
    max_new_tokens=4096,  # Increase from 2048
    # ...
)
```

2. **Check reference audio:**
   - Ensure reference audio is clear (no background noise)
   - Ensure reference text exactly matches the audio
   - Reference should be 3-10 seconds long

3. **Verify language parameter:**
```python
# Use "Auto" if unsure
language="Auto"
```

---

### 3.2 Generation Quality Issues

**Symptom:** Audio has artifacts, sounds robotic, or doesn't match voice.

**Solutions:**

1. **Use higher quality reference:**
   - Clear recording (no reverb, noise)
   - Natural speaking pace
   - Good microphone quality

2. **Match reference text exactly:**
   - Include punctuation
   - Match capitalization
   - Include filler words if present

3. **Use 1.7B model** (if using 0.6B):
```python
MODEL_ID = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"
```

4. **Adjust generation parameters:**
```python
wavs, sr = self.model.generate_voice_clone(
    text=text,
    language=language,
    ref_audio=ref_audio,
    ref_text=ref_text,
    top_p=0.9,
    temperature=0.7,
)
```

---

### 3.3 Request Timeout

**Symptom:**
```
504 Gateway Timeout
TimeoutError: Request timed out
```

**Cause:** Generation takes too long.

**Solutions:**

1. **Increase timeout:**
```python
@app.cls(
    timeout=600,  # 10 minutes
    # ...
)
```

2. **Reduce text length:**
```python
# Split long texts into shorter chunks
max_chars_per_request = 500
```

3. **Use batch endpoint** for multiple short texts instead of one long text.

---

### 3.4 Concurrent Request Errors

**Symptom:**
```
RuntimeError: CUDA error: out of memory
```
When multiple requests hit simultaneously.

**Cause:** Too many concurrent requests per container.

**Solution:** Reduce concurrency:

```python
@modal.concurrent(max_inputs=5)  # Reduce from 10
class Qwen3TTSService:
    # ...
```

---

## 4. Network & Endpoint Issues

### 4.1 Endpoint Returns 404

**Symptom:**
```
404 Not Found
```

**Cause:** Wrong URL or app not deployed.

**Solutions:**

1. **Verify deployment:**
```bash
modal app list
```

2. **Check exact URL:** Endpoint URLs follow this pattern:
```
https://{workspace}--{app-name}-{class-name}-{method-name}.modal.run
```

3. **Redeploy:**
```bash
modal deploy app.py
```

---

### 4.2 Endpoint Returns 422 Validation Error

**Symptom:**
```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "ref_text"],
      "msg": "Field required"
    }
  ]
}
```

**Cause:** Invalid request payload.

**Solution:** Check your request matches the schema:

```json
{
  "text": "Required: text to synthesize",
  "language": "Optional: defaults to Auto",
  "ref_audio_url": "Required if ref_audio_base64 not provided",
  "ref_text": "Required: transcript of reference",
  "max_new_tokens": "Optional: defaults to 2048"
}
```

---

### 4.3 CORS Errors (Browser)

**Symptom:**
```
Access to fetch at 'https://...' from origin 'http://localhost' has been blocked by CORS policy
```

**Cause:** Browser blocks cross-origin requests.

**Solution:** Add CORS middleware:

```python
from fastapi.middleware.cors import CORSMiddleware

# After creating the FastAPI app (if using @modal.asgi_app)
# For @modal.fastapi_endpoint, you may need to switch to @modal.asgi_app

# Example with asgi_app:
from fastapi import FastAPI

web_app = FastAPI()
web_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

### 4.4 SSL Certificate Error

**Symptom:**
```
SSL: CERTIFICATE_VERIFY_FAILED
```

**Cause:** Issues with SSL verification.

**Solution:** This usually indicates a network/proxy issue. If testing locally:

```python
import ssl
ssl._create_default_https_context = ssl._create_unverified_context
```

**Warning:** Only use this for testing, not production.

---

## 5. Performance Issues

### 5.1 Slow Cold Starts

**Symptom:** First request takes 2-5 minutes.

**Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Model download | Pre-download to volume |
| Large image | Minimize image layers |
| Model loading | Use smaller model (0.6B) |

**Optimized setup:**
```python
# 1. Pre-download models
# modal run download_models.py

# 2. Minimal image
image = modal.Image.debian_slim(python_version="3.12")
image = image.apt_install("libsndfile1")  # Only required packages
image = image.pip_install("qwen-tts", "fastapi[standard]", "soundfile")

# 3. Keep containers warm
@app.cls(scaledown_window=600)  # 10 minutes
```

---

### 5.2 High Latency Per Request

**Symptom:** Each request takes 10-20+ seconds.

**Solutions:**

1. **Check attention implementation:**
```python
# In logs, verify:
# "Attention implementation: sdpa" (good)
# "Attention implementation: eager" (slower)
```

2. **Use batch endpoint** for multiple texts

3. **Reduce max_new_tokens** for shorter texts:
```python
max_new_tokens=1024  # Instead of 2048
```

4. **Use faster GPU:**
```python
GPU_TYPE = "A100-40GB"  # Faster than A10G
```

---

### 5.3 Container Keeps Scaling Down

**Symptom:** Every request is a cold start.

**Cause:** `scaledown_window` too short.

**Solution:** Increase idle timeout:

```python
@app.cls(
    scaledown_window=600,  # 10 minutes
    # ...
)
```

Or implement a keep-alive mechanism:

```python
# External cron job hitting /health every 5 minutes
curl https://your-endpoint/health
```

---

## Debug Mode

Add comprehensive logging to diagnose issues:

```python
@modal.enter()
def load_model(self):
    import torch
    import os

    print("=" * 60)
    print("DEBUG: Environment")
    print("=" * 60)
    print(f"CUDA available: {torch.cuda.is_available()}")
    print(f"CUDA version: {torch.version.cuda}")
    print(f"PyTorch version: {torch.__version__}")

    if torch.cuda.is_available():
        print(f"GPU: {torch.cuda.get_device_name(0)}")
        print(f"GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")

    print(f"\nHF_HOME: {os.environ.get('HF_HOME', 'not set')}")
    print(f"Volume contents at {MODELS_DIR}:")
    if os.path.exists(MODELS_DIR):
        for item in os.listdir(MODELS_DIR):
            print(f"  - {item}")
    else:
        print("  Volume not mounted!")

    print("=" * 60)
    # ... rest of model loading
```

---

## Getting Help

If issues persist:

1. **Check Modal status:** [status.modal.com](https://status.modal.com)

2. **Modal documentation:** [modal.com/docs](https://modal.com/docs)

3. **Qwen3-TTS issues:** [GitHub Issues](https://github.com/QwenLM/Qwen3-TTS/issues)

4. **Modal community:** [Modal Slack](https://modal.com/slack)

---

## Checklist for Reporting Issues

When asking for help, include:

- [ ] Modal CLI version (`modal --version`)
- [ ] Full error message and stack trace
- [ ] Relevant code snippets
- [ ] Steps to reproduce
- [ ] Output of `modal app logs qwen3-tts-voice-clone`
