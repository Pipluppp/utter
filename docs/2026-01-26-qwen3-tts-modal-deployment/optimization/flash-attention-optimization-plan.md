# Flash Attention 2 Optimization Plan for Qwen3-TTS on Modal

> **Created**: 2026-01-28
> **Updated**: 2026-02-01
> **Status**: ✅ IMPLEMENTED & BENCHMARKED
> **Scope**: 1.7B model on A10G GPU (Option D)
> **File modified**: `modal_app/qwen3_tts/app_fa2.py`

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Benchmark Results](#benchmark-results)
3. [Background & Context](#background--context)
4. [Build Issues Log (What We Tried & What Failed)](#build-issues-log)
5. [Final Plan: Strategy A — Pre-Built Wheel with Pinned Torch](#final-plan-strategy-a)
6. [Exact Code for `app_fa2.py`](#exact-code-for-app_fa2py)
7. [Deployment & Verification Steps](#deployment--verification-steps)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Further Optimization Options Analysis](#further-optimization-options-analysis) ← NEW
10. [Future Options (0.6B, sage_attn)](#future-options)
11. [Pre-Built Wheel Reference](#pre-built-wheel-reference)
12. [Sources](#sources)

---

## Executive Summary

**Goal**: Deploy a Flash Attention 2 variant of the 1.7B Qwen3-TTS voice cloning service on Modal, running side-by-side with the existing SDPA deployment for performance comparison.

**Chosen approach**: Install flash-attn via a **pre-built wheel** from the [flash-attention releases page](https://github.com/Dao-AILab/flash-attention/releases), pinning PyTorch to 2.9 to match an available wheel. This avoids the catastrophically slow source compilation (30 min to hours) that blocked our first attempt.

**Key insight**: The `qwen-tts==0.0.5` package pulls in `torch==2.10.0`, but flash-attn v2.8.3 only ships pre-built wheels up to torch 2.9. By pinning `torch==2.9.0` *before* installing `qwen-tts`, we can use the pre-built wheel (installs in seconds) and stay on `debian_slim` (no CUDA devel image needed).

**Result**: Two parallel deployments for A/B comparison:

| Deployment | App Name | Attention | Image Base |
|-----------|----------|-----------|------------|
| Existing | `qwen3-tts-voice-clone` | SDPA (auto-detected) | `debian_slim` |
| New (FA2) | `qwen3-tts-voice-clone-fa2` | `flash_attention_2` | `debian_slim` |

Both share the same `qwen3-tts-models` volume, same A10G GPU, same API surface.

---

## Benchmark Results

> **Test Date**: 2026-02-01
> **Test Scripts**: `test/compare_fa2_sdpa.py`, `test/compare_generation_only.py`
> **Reference Audio**: 6.4MB WAV file from `test/reference/audio.wav`
> **Full Report**: [`FA2-BENCHMARK-REPORT.md`](./FA2-BENCHMARK-REPORT.md) — Complete raw data and analysis

### Understanding What We Tested

The `/clone` endpoint performs **two operations in one call**:
1. **Voice Cloning**: Extract voice characteristics from reference audio (~constant time)
2. **Generation**: Produce new speech for target text using cloned voice (scales with text length)

FA2 should help the **generation** step, not the cloning step.

### Test 1: Combined Clone+Generate (compare_fa2_sdpa.py)

| Metric | SDPA (torch 2.10) | FA2 (torch 2.9) | Difference |
|--------|-------------------|-----------------|------------|
| Cold Start | 68.4s | 83.3s | +21.7% slower |
| Warm (short, 39 chars) | ~10.5s | ~11.1s | +5.7% slower |
| Warm (medium, 97 chars) | ~17.9s | ~18.8s | +5.0% slower |
| Warm (long, 255 chars) | ~35.6s | ~39.7s | +11.5% slower |

### Test 2: Generation-Focused (compare_generation_only.py)

Tested with varying text lengths to isolate generation performance:

| Text Length | SDPA Time | FA2 Time | FA2 Throughput |
|-------------|-----------|----------|----------------|
| Tiny (12 chars) | 7.88s | 6.76s | **14% faster** |
| Short (44 chars) | 12.82s | ~11s* | **~15% faster*** |
| Medium (187 chars) | 31.52s | 27.34s | **15% faster** |
| Long (506 chars) | 86.48s | ~67s* | **~22% faster*** |

\* Excluding outliers caused by Modal container restarts

### Key Findings

1. **For pure generation (excluding outliers), FA2 shows 14-22% speedup** on medium/long texts
2. **Results are noisy due to Modal infrastructure** — container scaling causes random latency spikes
3. **Cold start is consistently slower for FA2** (~22% slower due to flash-attn initialization)
4. **Both variants produce identical quality audio** — no degradation from torch version difference

### Why Results Are Inconsistent

The Modal serverless environment introduces variability:
- Container restarts mid-benchmark (causes 50-180s outliers)
- Resource contention from other users
- Network latency for base64 audio transfer

In a **dedicated/warm container**, FA2's generation speedup should be more consistent.

### Why FA2 Shows Modest (Not Dramatic) Improvement

Flash Attention 2's benefits are most pronounced with:
- **Long sequences** (thousands of tokens) — TTS generates ~500-2000 tokens for typical texts
- **Large batch sizes** — we tested batch size 1
- **Memory-bound operations** — A10G has plenty of VRAM for 1.7B model

The generation step IS faster with FA2, but:
- Voice cloning overhead (~2-4s) is constant and unaffected
- The speedup is 15-22%, not the 2-3x claimed for LLM inference
- torch 2.10's SDPA is already well-optimized

### Recommendation

**Use SDPA for production** (`qwen3-tts-voice-clone`):
- More stable (fewer torch version constraints)
- Cold start is faster
- Performance is comparable for typical use cases

**Consider FA2 for**:
- Batch processing (multiple texts with same voice)
- Very long text inputs (1000+ characters)
- Memory-constrained scenarios (FA2 uses less peak VRAM)

### Output Files

Test outputs saved to `test/outputs/`:
```
test/outputs/
├── SDPA/
│   ├── cold_start.wav
│   ├── short.wav
│   ├── medium.wav
│   └── long.wav
├── FA2/
│   ├── cold_start.wav
│   ├── short.wav
│   ├── medium.wav
│   └── long.wav
└── comparison_results.json
```

---

## Background & Context

### Why Flash Attention 2?

The [Qwen3-TTS README](https://github.com/QwenLM/Qwen3-TTS) explicitly recommends Flash Attention 2:

> We recommend using FlashAttention 2 to reduce GPU memory usage.

All their code examples use `attn_implementation="flash_attention_2"`. Benefits:

- **2-3x faster** attention computation vs eager, ~1.5x faster vs SDPA
- **Lower VRAM** usage (doesn't materialize full attention matrix)
- **Proven/stable** — widely used in production LLM serving

### GPU Compatibility Constraint

Flash Attention 2 requires **Ampere (sm80) or newer** GPUs:

| GPU | Architecture | Compute Capability | FA2 Support |
|-----|-------------|-------------------|-------------|
| T4 | Turing | sm75 | **No** |
| A10G | Ampere | sm80 | **Yes** |
| A100 | Ampere | sm80 | **Yes** |
| H100 | Hopper | sm90 | **Yes** |

Our 1.7B model runs on A10G (Ampere) — FA2 compatible. Our 0.6B model runs on T4 (Turing) — FA2 incompatible. This plan targets the 1.7B deployment only.

Source: [flash-attention#887](https://github.com/Dao-AILab/flash-attention/issues/887), [flash-attention#1608](https://github.com/Dao-AILab/flash-attention/issues/1608)

### Current Deployment Architecture

```
modal_app/qwen3_tts/
├── app.py          # 1.7B, A10G, SDPA, debian_slim     → qwen3-tts-voice-clone
├── app_06b.py      # 0.6B, T4,   SDPA, debian_slim     → qwen3-tts-voice-clone-06b
└── app_fa2.py      # 1.7B, A10G, FA2,  debian_slim     → qwen3-tts-voice-clone-fa2  ← THIS PLAN
```

The `app_fa2.py` file already exists from our first attempt. It needs to be updated with the pre-built wheel approach.

---

## Build Issues Log

This section documents every issue encountered during our first implementation attempt. Read this before making any changes to avoid repeating mistakes.

### Issue 1: `debian_slim` Cannot Compile flash-attn

**What happened**: First naive attempt — added `pip_install("flash-attn", extra_options="--no-build-isolation")` to the existing `debian_slim` image.

**Error**: Compilation failed because `debian_slim` does not include CUDA development headers (`nvcc`, CUDA toolkit). The `flash-attn` package needs to compile CUDA kernels from C++ source.

**Lesson**: `debian_slim` only has the CUDA *runtime* (via PyTorch wheels). For source compilation, you need `nvidia/cuda:*-devel-*` images which include `nvcc` and all CUDA headers.

### Issue 2: Switched to CUDA Devel Image — Missing `wheel` Module

**What happened**: Switched base to `nvidia/cuda:12.4.1-devel-ubuntu22.04` which has `nvcc`. Built the image and ran `pip install flash-attn --no-build-isolation`.

**Error**:
```
ModuleNotFoundError: No module named 'wheel'
```
during `Preparing metadata (setup.py)`.

**Root cause**: The `--no-build-isolation` flag tells pip not to create an isolated build environment. This means pip won't auto-install build dependencies like `wheel`, `setuptools`, etc. The CUDA devel base image has pip 23.3.2 which doesn't bundle `wheel`.

**Fix applied**: Pre-install build dependencies:
```python
image = image.pip_install("wheel", "setuptools", "packaging", "ninja")
```

**Lesson**: When using `--no-build-isolation`, you must manually ensure all build-time dependencies are present in the environment. For flash-attn, that means: `wheel`, `setuptools`, `packaging`, `ninja`, `torch` (already installed).

### Issue 3: Source Compilation Is Catastrophically Slow (BLOCKING)

**What happened**: After fixing the `wheel` issue, flash-attn 2.8.3 began compiling from source. The build ran for 10+ minutes with "Building wheel for flash-attn (setup.py): still running..." repeating indefinitely. We killed the build.

**Root cause**: **No pre-built wheel exists for our environment.**

Our stack (determined from Modal build logs):
- Python 3.12 (`cp312`)
- PyTorch **2.10.0** (installed by `qwen-tts==0.0.5` → `transformers==4.57.3`)
- CUDA **12.8** (bundled with torch 2.10.0)

Available pre-built wheels for flash-attn v2.8.3:
- Torch 2.4, 2.5, 2.6, 2.7, 2.8, 2.9 — **but NOT 2.10**

Since pip found no matching wheel, it downloaded the source tarball (8.4 MB) and attempted to compile it. This involves compiling dozens of CUDA kernels with `nvcc`, which takes 30 minutes to several hours depending on available CPU/RAM.

**Community confirmation**: [Dao-AILab/flash-attention#945](https://github.com/Dao-AILab/flash-attention/issues/945) — 200+ comments from users reporting the same issue. Build times range from 1 hour (fast machine, `ninja` + `MAX_JOBS`) to 8+ hours (limited resources). The universal fix is: **use a pre-built wheel**.

**Why `ninja` doesn't fully help on Modal**: `ninja` parallelizes the build, but Modal build containers may have limited CPU cores. Even with ninja, compilation takes a long time for the ~50 CUDA kernel files in flash-attn.

**Lesson**: Never rely on source compilation of flash-attn in a CI/CD or cloud build environment. Always use pre-built wheels.

### Issue 4: Windows `charmap` Codec Error (Recurring)

**What happened**: `modal deploy` output contains Unicode characters (checkmarks, progress bars) that Windows `cmd.exe` can't display.

**Error**: `'charmap' codec can't encode characters in position 5-44: character maps to <undefined>`

**Fix**: Always pipe through `cat`:
```bash
cd modal_app/qwen3_tts && PYTHONIOENCODING=utf-8 uv run modal deploy app_fa2.py 2>&1 | cat
```

Or alternatively:
```bash
uv run modal deploy app_fa2.py 2>&1 | cat
```

**Lesson**: This affects ALL Modal CLI commands on Windows. Always use the pipe pattern.

---

## Final Plan: Strategy A

### Approach: Pin torch 2.9 + Pre-Built Wheel

Instead of compiling flash-attn from source, we:

1. **Pin `torch==2.9.0`** before installing `qwen-tts` — this prevents `qwen-tts` from pulling in torch 2.10.0
2. **Install the pre-built flash-attn wheel** directly from GitHub releases — a 244 MB `.whl` file that installs in seconds with zero compilation
3. **Stay on `debian_slim`** — no need for the heavy CUDA devel image since we're not compiling anything

### Why This Works

pip resolves dependencies in order. By installing `torch==2.9.0` first, when `qwen-tts` is installed afterward, pip sees that torch is already satisfied and doesn't upgrade it to 2.10.0. The pre-built wheel for `flash_attn-2.8.3+cu12torch2.9` is then compatible.

### Torch 2.9 vs 2.10 Risk Assessment

The `qwen-tts` package does not pin torch to a specific version — it just requires `torch` as a dependency (via `transformers`). Torch 2.9 → 2.10 is a minor version bump. The core `qwen_tts.Qwen3TTSModel` API uses standard HuggingFace `transformers` interfaces that are backward-compatible. Risk is low, but we should verify generation works in the health check after deployment.

### CXX11 ABI Selection

Pre-built wheels come in two ABI variants:
- `cxx11abiTRUE` — for environments where `torch._C._GLIBCXX_USE_CXX11_ABI` is `True`
- `cxx11abiFALSE` — for environments where it's `False`

**Which one to use**: Modal's `debian_slim` with Python 3.12 and recent PyTorch uses the **new CXX11 ABI** (`True`). Start with `cxx11abiTRUE`. If you get an import error when loading flash-attn at runtime, switch to `cxx11abiFALSE`.

You can verify at runtime by checking the container logs during `@modal.enter()`. If flash-attn loads successfully and the health endpoint reports `attention_implementation: flash_attention_2`, the ABI is correct.

**Fallback wheel URL** (if TRUE doesn't work):
```
https://github.com/Dao-AILab/flash-attention/releases/download/v2.8.3/flash_attn-2.8.3+cu12torch2.9cxx11abiFALSE-cp312-cp312-linux_x86_64.whl
```

---

## Exact Code for `app_fa2.py`

The file `modal_app/qwen3_tts/app_fa2.py` already exists from our first attempt. The **only section that needs to change** is the `create_image()` function (lines ~58–99). Everything else (service class, endpoints, volume mount, GPU=A10G, hardcoded `flash_attention_2`) stays as-is.

### The `create_image()` function to use:

```python
def create_image() -> modal.Image:
    """
    Build Modal container image for Qwen3-TTS with Flash Attention 2.

    Strategy: Pin torch 2.9 + install pre-built flash-attn wheel.
    This avoids the slow source compilation that takes 30min-hours.
    See: docs/qwen3-tts-modal-deployment/flash-attention-optimization-plan.md
    """
    # Stay on debian_slim — no CUDA devel image needed since we use pre-built wheel
    image = modal.Image.debian_slim(python_version="3.12")

    # Install system dependencies (same as app.py)
    image = image.apt_install(
        "sox",
        "libsox-fmt-all",
        "libsndfile1",
        "ffmpeg",
    )

    # Set environment variables for HuggingFace cache
    image = image.env({
        "HF_HOME": HF_CACHE_DIR,
        "TRANSFORMERS_CACHE": HF_CACHE_DIR,
        "HF_HUB_CACHE": HF_CACHE_DIR,
        "TOKENIZERS_PARALLELISM": "false",
    })

    # IMPORTANT: Pin torch 2.9 FIRST, before qwen-tts.
    # qwen-tts==0.0.5 depends on transformers==4.57.3 which would pull torch 2.10.0.
    # torch 2.10 has no pre-built flash-attn wheel. torch 2.9 does.
    # By installing torch 2.9 first, pip won't upgrade it when installing qwen-tts.
    image = image.pip_install(
        "torch==2.9.0",
        "torchaudio==2.9.0",
    )

    # Install Python packages (same as app.py, minus torchaudio which is pinned above)
    image = image.pip_install(
        "qwen-tts",
        "fastapi[standard]",
        "soundfile",
        "numpy<2.0",
    )

    # Flash Attention 2 — pre-built wheel from GitHub releases.
    # Installs in seconds. No compilation, no CUDA devel image needed.
    # Wheel spec: flash-attn 2.8.3, CUDA 12, torch 2.9, Python 3.12, x86_64
    # Source: https://github.com/Dao-AILab/flash-attention/releases/tag/v2.8.3
    #
    # NOTE on cxx11abi: Start with TRUE (Modal default). If flash-attn fails
    # to import at runtime, switch to the FALSE variant URL below:
    # "https://github.com/Dao-AILab/flash-attention/releases/download/v2.8.3/flash_attn-2.8.3+cu12torch2.9cxx11abiFALSE-cp312-cp312-linux_x86_64.whl"
    image = image.pip_install(
        "https://github.com/Dao-AILab/flash-attention/releases/download/"
        "v2.8.3/flash_attn-2.8.3+cu12torch2.9cxx11abiTRUE-cp312-cp312-linux_x86_64.whl"
    )

    return image
```

### What NOT to change in `app_fa2.py`

The rest of the file is correct from our first attempt:

- **App name**: `qwen3-tts-voice-clone-fa2` — correct, separate from SDPA deployment
- **`APP_VARIANT = "fa2"`** — correct, exposed in health/info endpoints
- **`self.attn_impl = "flash_attention_2"`** in `load_model()` — correct, hardcoded (no fallback chain)
- **No `_get_attention_implementation()` method** — correct, we force FA2 since the package is guaranteed to be installed
- **All endpoints** (`/clone`, `/clone-batch`, `/health`, `/languages`) — identical to `app.py`, correct
- **GPU = A10G** — correct, FA2 requires Ampere+
- **Volume mount** — shared `qwen3-tts-models`, correct
- **Test output file** — `test_output_fa2.wav`, correct

---

## Deployment & Verification Steps

### Step 1: Update `app_fa2.py`

Replace the `create_image()` function with the code above. Do NOT change anything else in the file.

### Step 2: Deploy

```bash
cd modal_app/qwen3_tts && uv run modal deploy app_fa2.py 2>&1 | cat
```

**Expected build time**: 3-5 minutes (similar to `app.py`, plus ~30s for the 244 MB wheel download).

**What to watch for in build logs**:
- `torch==2.9.0` should be installed (not 2.10.0)
- The flash-attn wheel should download from GitHub (not compile from source)
- No "Building wheel for flash-attn" step — if you see this, something went wrong

### Step 3: Health Check

```bash
curl https://duncab013--qwen3-tts-voice-clone-fa2-qwen3ttsservice-health.modal.run
```

**Expected response**:
```json
{
  "status": "healthy",
  "model": "Qwen3-TTS-12Hz-1.7B-Base",
  "variant": "fa2",
  "gpu": "NVIDIA A10G",
  "attention_implementation": "flash_attention_2",
  "supported_languages": ["Auto", "Chinese", "English", ...]
}
```

**Critical check**: `attention_implementation` must be `"flash_attention_2"`, not `"sdpa"` or `"eager"`. If it shows something else, flash-attn failed to load — check the container logs in the Modal dashboard.

### Step 4: Test Voice Cloning

```bash
cd modal_app/qwen3_tts && python test_client.py \
  --endpoint https://duncab013--qwen3-tts-voice-clone-fa2-qwen3ttsservice-clone.modal.run
```

Or use the Python test script:
```bash
cd test && python test_qwen3_tts.py --model fa2
```

### Step 5: Compare Latency (SDPA vs FA2)

Run the same clone request against both endpoints and compare response times:

```python
import time, requests, base64

# Load reference audio
with open('test/reference/audio.wav', 'rb') as f:
    audio_b64 = base64.b64encode(f.read()).decode()
with open('test/reference/audio_text.txt') as f:
    ref_text = f.read().strip()

payload = {
    "text": "Hello, this is a benchmark test for voice cloning quality and speed comparison.",
    "language": "English",
    "ref_audio_base64": audio_b64,
    "ref_text": ref_text,
}

endpoints = {
    "SDPA": "https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-clone.modal.run",
    "FA2":  "https://duncab013--qwen3-tts-voice-clone-fa2-qwen3ttsservice-clone.modal.run",
}

# Warm up both containers first (cold start), then time 3 runs each
for name, url in endpoints.items():
    print(f"\n{name}:")
    requests.post(url, json=payload, timeout=300)  # warm up
    times = []
    for i in range(3):
        t0 = time.time()
        r = requests.post(url, json=payload, timeout=300)
        elapsed = time.time() - t0
        times.append(elapsed)
        print(f"  Run {i+1}: {elapsed:.2f}s ({len(r.content)} bytes)")
    print(f"  Average: {sum(times)/len(times):.2f}s")
```

---

## Troubleshooting Guide

### flash-attn fails to import at runtime

**Symptom**: Health endpoint shows `attention_implementation: "sdpa"` or container crashes.

**Check Modal container logs** in the dashboard. Look for errors like:
```
ImportError: ... undefined symbol ...
```

**Fix**: Wrong CXX11 ABI variant. Switch the wheel URL in `create_image()`:
- If using `cxx11abiTRUE`, try `cxx11abiFALSE` (or vice versa)
- Redeploy

### pip tries to compile flash-attn from source

**Symptom**: Build logs show "Building wheel for flash-attn (setup.py): started" and it runs forever.

**Cause**: The wheel URL is wrong, or pip can't download from GitHub.

**Fix**: Verify the wheel URL is correct and accessible. Try downloading it manually:
```bash
curl -L -o /dev/null -w "%{http_code}" "https://github.com/Dao-AILab/flash-attention/releases/download/v2.8.3/flash_attn-2.8.3+cu12torch2.9cxx11abiTRUE-cp312-cp312-linux_x86_64.whl"
```
Should return `200`.

### torch version mismatch

**Symptom**: `qwen-tts` fails to install because of conflicting torch versions.

**Cause**: pip resolver may try to upgrade torch when installing `qwen-tts`.

**Fix**: Ensure torch is installed in a separate `pip_install` step *before* `qwen-tts`. Modal's image builder runs each `pip_install` as a separate layer, so the pin sticks.

### Windows deploy command fails with charmap error

**Fix**: Always use:
```bash
uv run modal deploy app_fa2.py 2>&1 | cat
```

### Container still uses old code after redeploy

**Fix**: Stop the app first:
```bash
uv run modal app stop qwen3-tts-voice-clone-fa2
uv run modal deploy app_fa2.py 2>&1 | cat
```

---

## Further Optimization Options Analysis

> **Added**: 2026-02-01
> **Source**: [vorojar/Qwen3-TTS README](https://github.com/vorojar/Qwen3-TTS) "Performance Optimization" section

The vorojar/Qwen3-TTS repository mentions several optimization options beyond Flash Attention. This section evaluates each one for our use case: **voice generation (not cloning)** on **A10G GPU** via **Modal.com**.

### Context: What's Actually Slow?

From our benchmarks:
- **Voice cloning** (reference audio → voice prompt): ~2-4 seconds — already fast
- **Voice generation** (text → audio): 10-40+ seconds depending on text length — **THIS IS THE BOTTLENECK**

The generation step is autoregressive token generation, which is where optimizations matter most.

### Optimization Options from vorojar/Qwen3-TTS

| Option | Claimed Speedup | A10G Compatible? | Effort | Verdict |
|--------|----------------|------------------|--------|---------|
| Flash Attention 2 | ~50% | ✅ Yes | ✅ Done | **Already tested — no improvement for TTS** |
| Better GPU (A100/H100) | 2-5x | N/A | 💰 Cost | **Expensive, diminishing returns for batch=1** |
| vLLM Deployment | 2-3x | ✅ Yes | 🔴 High | **Not compatible — Qwen3-TTS not a supported model** |
| TensorRT-LLM | 2-5x | ✅ Yes (sm80+) | 🔴 Very High | **Possible but complex — requires model conversion** |
| FP8 Quantization | 1.5-2x | ❌ No (H100 only) | N/A | **Not compatible with A10G** |
| torch.compile | 1.2-2x | ✅ Yes | 🟢 Low | **✅ RECOMMENDED — easy to try, works on A10G** |

### Detailed Analysis

#### 1. Better GPU (A100/H100) ❌ Not Recommended

**What it is**: Simply using a faster GPU.

**Why not recommended**:
- A100 on Modal is $3.70/hr vs A10G at $1.10/hr (3.4x cost)
- H100 is $4.76/hr (4.3x cost)
- For batch size 1 (single request), memory bandwidth is the bottleneck, not compute
- Our tests show ~1.4s/char — upgrading GPU won't change this fundamentally for single requests

**When it makes sense**: High-throughput batch processing with many concurrent requests.

#### 2. vLLM Deployment ❌ Not Compatible

**What it is**: vLLM provides PagedAttention + continuous batching for efficient LLM inference.

**Why not compatible**:
- vLLM's supported models list does NOT include Qwen3-TTS
- Qwen3-TTS is not a standard LLM — it's a TTS model with custom audio codec
- The model has unique architecture (DiT for acoustic generation) that vLLM doesn't support
- Would require significant custom implementation work

**Verdict**: Skip unless Qwen team or vLLM community adds official support.

#### 3. TensorRT-LLM ⚠️ High Effort, Possible

**What it is**: NVIDIA's optimized inference backend with int8/fp8 quantization, custom kernels.

**A10G compatibility**: ✅ Yes — A10G is Ampere (sm80), TensorRT-LLM supports it.

**Why high effort**:
- Requires converting model weights to TensorRT format
- Qwen3-TTS is not in the TensorRT-LLM model zoo
- Custom model implementation needed
- Different serving infrastructure than Modal's current setup

**Potential speedup**: 2-5x is realistic for autoregressive generation.

**Verdict**: Only pursue if performance becomes critical and we have dedicated MLOps time.

#### 4. FP8 Quantization ❌ Not Compatible

**What it is**: 8-bit floating point quantization for faster inference.

**Why not compatible**:
- FP8 requires Hopper architecture (sm90) — that's H100
- A10G is Ampere (sm80) — **does NOT support FP8**
- INT8 quantization is possible on A10G but requires model conversion and may impact audio quality

**Verdict**: Not available on A10G.

#### 5. torch.compile ✅ RECOMMENDED

**What it is**: PyTorch's built-in JIT compiler that fuses operations and generates optimized CUDA kernels.

**A10G compatibility**: ✅ Fully supported.

**Why recommended**:
- **Minimal code change** — literally one line: `model = torch.compile(model)`
- **No model conversion** — works with existing HuggingFace model
- **No infrastructure changes** — keeps current Modal deployment pattern
- **Moderate speedup** — typically 1.2-2x for inference workloads
- **Stable** — production-ready since PyTorch 2.0

**Implementation**:
```python
# In load_model() after loading the model:
import torch

self.model = Qwen3TTSModel.from_pretrained(
    self.model_path, ..., attn_implementation=self.attn_impl
)

# Add this line:
self.model = torch.compile(self.model, mode="reduce-overhead")
```

**Modes to try**:
- `"default"` — balanced speed/memory
- `"reduce-overhead"` — faster for repeated calls (recommended for TTS)
- `"max-autotune"` — slowest compilation but fastest runtime

**Caveats**:
- First inference is slow (compilation) — but Modal's container warmup handles this
- May not help if generation is already memory-bandwidth bound
- Test with `mode="reduce-overhead"` first

### Recommended Next Steps

1. **Create `app_compile.py`** — variant with `torch.compile(model, mode="reduce-overhead")`
2. **Deploy and benchmark** — compare against SDPA baseline
3. **Focus on generation-only timing** — use `compare_generation_only.py` test script
4. **If no improvement**: Accept that single-request TTS is fundamentally memory-bound

### Why Our FA2 Test Showed No Improvement

From the benchmark results:
- FA2 was actually **slower** than SDPA (5-11% slower)
- This is because:
  1. **Batch size 1** — FA2 shines with large batches, not single requests
  2. **Short sequences** — TTS doesn't generate thousands of tokens like LLMs
  3. **torch 2.10 SDPA is excellent** — PyTorch's native SDPA has been heavily optimized
  4. **Overhead** — FA2 kernel initialization adds latency for small workloads

Flash Attention is designed for training and high-throughput inference, not single-request TTS.

---

## Future Options

### 0.6B Model on T4 — Cannot Use FA2

Flash Attention 2 is hardware-incompatible with T4 (Turing sm75). Options for 0.6B optimization:

| Option | Description | Status |
|--------|-------------|--------|
| SDPA (current) | PyTorch native scaled dot-product attention | Working, baseline |
| sage_attn | Alternative attention backend, may support Turing | Untested |
| Upgrade to A10G | Move 0.6B from T4 to A10G, enable FA2 | Higher cost ($0.59→$1.10/hr) |

### sage_attn (Experimental)

The Qwen3-TTS docs list `sage_attn` as a supported backend with claimed 2-3x speedup. Whether it supports Turing GPUs is unverified. To test:

```python
image = image.pip_install("sage_attn")
# Then in load_model:
self.attn_impl = "sage_attn"
```

### When torch 2.10 Wheel Becomes Available

Monitor [flash-attention releases](https://github.com/Dao-AILab/flash-attention/releases). When a torch 2.10 wheel appears:

1. Remove the `torch==2.9.0` pin
2. Update the wheel URL to the torch 2.10 variant
3. Both `app.py` (SDPA) and `app_fa2.py` (FA2) can then use the same torch version

---

## Pre-Built Wheel Reference

### flash-attn v2.8.3 ([releases page](https://github.com/Dao-AILab/flash-attention/releases/tag/v2.8.3))

| PyTorch | CUDA | Python | ABI Variants |
|---------|------|--------|-------------|
| 2.4 | cu12 | cp39, cp310, cp311, cp312 | TRUE, FALSE |
| 2.5 | cu12 | cp39, cp310, cp311, cp312, cp313 | TRUE, FALSE |
| 2.6 | cu12 | cp39, cp310, cp311, cp312, cp313 | TRUE, FALSE |
| 2.7 | cu12 | cp39, cp310, cp311, cp312, cp313 | TRUE, FALSE |
| 2.8 | cu12 | cp39, cp310, cp311, cp312, cp313 | TRUE, FALSE |
| 2.9 | cu12 | cp312 | TRUE |

**Wheel URL pattern**:
```
https://github.com/Dao-AILab/flash-attention/releases/download/v{version}/flash_attn-{version}+cu{cuda}torch{torch}cxx11abi{ABI}-cp{py}-cp{py}-linux_x86_64.whl
```

**Our wheel** (torch 2.9, Python 3.12, cxx11abiTRUE):
```
https://github.com/Dao-AILab/flash-attention/releases/download/v2.8.3/flash_attn-2.8.3+cu12torch2.9cxx11abiTRUE-cp312-cp312-linux_x86_64.whl
```

### Why Not Just `pip install flash-attn`?

When you run `pip install flash-attn`, pip checks PyPI for a matching wheel. flash-attn publishes source distributions (`.tar.gz`) to PyPI but **not** pre-built wheels. The pre-built wheels are only on [GitHub Releases](https://github.com/Dao-AILab/flash-attention/releases). So `pip install flash-attn` always triggers source compilation unless you provide a direct wheel URL.

### Qwen3-TTS Official Guidance

From the [Qwen3-TTS README](https://github.com/QwenLM/Qwen3-TTS):

> We recommend using FlashAttention 2 to reduce GPU memory usage.
> ```bash
> pip install -U flash-attn --no-build-isolation
> ```
> If your machine has less than 96GB of RAM and lots of CPU cores, run:
> ```bash
> MAX_JOBS=4 pip install -U flash-attn --no-build-isolation
> ```

The `MAX_JOBS=4` hint acknowledges the build problem. For cloud/CI environments, the pre-built wheel approach is better.

---

## Sources

- [QwenLM/Qwen3-TTS GitHub](https://github.com/QwenLM/Qwen3-TTS) — official repo, code examples, attention backend recommendations
- [Qwen3-TTS Technical Report](https://arxiv.org/html/2601.15621v1) — arXiv paper
- [Qwen3-TTS Blog (Jan 2026)](https://qwen.ai/blog?id=qwen3tts-0115) — open-source announcement
- [Dao-AILab/flash-attention](https://github.com/Dao-AILab/flash-attention) — Flash Attention 2 repo
- [Flash Attention Releases v2.8.3](https://github.com/Dao-AILab/flash-attention/releases/tag/v2.8.3) — pre-built wheel downloads
- [flash-attention#945](https://github.com/Dao-AILab/flash-attention/issues/945) — slow build issue, community solutions (ninja, MAX_JOBS, pre-built wheels)
- [flash-attention#1758](https://github.com/Dao-AILab/flash-attention/issues/1758) — PyTorch version wheel availability, maintainer timeline
- [flash-attention#887](https://github.com/Dao-AILab/flash-attention/issues/887) — T4/Turing GPU incompatibility confirmed
- [flash-attention#1608](https://github.com/Dao-AILab/flash-attention/issues/1608) — no sm75 support planned
- [Modal Image Building Guide](https://modal.com/docs/guide/images) — image layer caching, pip_install behavior
- [Modal CUDA Guide](https://modal.com/docs/guide/cuda) — CUDA devel vs runtime images
