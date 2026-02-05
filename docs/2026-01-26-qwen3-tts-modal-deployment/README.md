# Qwen3-TTS Voice Cloning: Modal.com Deployment Guide

> **Target Models**: `Qwen3-TTS-12Hz-1.7B-Base`, `Qwen3-TTS-12Hz-0.6B-Base`
> **Platform**: Modal.com Serverless GPU Infrastructure
> **Last Updated**: 2026-02-02

---

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| 1.7B-Base Model Download | ✅ Complete | 4.23 GB in Modal volume |
| 1.7B-Base Service (SDPA) | 🛑 Stopped | Benchmarked, stopped to free endpoints |
| 0.6B-Base Model Download | ✅ Complete | 2.34 GB in Modal volume |
| 0.6B-Base Service (SDPA) | ✅ **Deployed** | A10G GPU — ⭐ **Fastest config** |
| **1.7B-VoiceDesign** | 🔜 **Ready** | `app_voice_design.py` created |
| VoiceDesign Model Download | ⏳ Pending | ~4.5 GB estimated |
| VoiceDesign Service | ⏳ Pending | Deploy with `modal deploy app_voice_design.py` |
| API Endpoints | ✅ Complete | `/clone`, `/clone-batch`, `/health`, `/languages` |
| Utter Backend Integration | ✅ Complete | Backend + frontend wired to Qwen3-TTS |
| FA2 Benchmark | ✅ Complete | SDPA faster — FA2 stopped |
| Full GPU/Model Benchmark | ✅ Complete | See results below |

---

## Benchmark Results

### Complete Model & GPU Comparison (2026-02-02)

All configurations use **SDPA** (Scaled Dot-Product Attention).

| Model | GPU | Cold Start | Short (56 chars) | Medium (800 chars) |
|-------|-----|------------|------------------|-------------------|
| **Qwen3-TTS-12Hz-0.6B-Base** | NVIDIA A10G | **29s** | **11.1s** | **87.6s** |
| **Qwen3-TTS-12Hz-1.7B-Base** | NVIDIA A10G | 108s | 14.6s | 113s |
| **Qwen3-TTS-12Hz-0.6B-Base** | Tesla T4 | 43s | 17.4s | 176s |

### Key Finding: 0.6B on A10G is Fastest

| Comparison | Speed Improvement |
|------------|-------------------|
| 0.6B A10G vs 1.7B A10G (cold start) | **3.7x faster** |
| 0.6B A10G vs 1.7B A10G (medium text) | **22% faster** |
| 0.6B A10G vs 0.6B T4 (medium text) | **50% faster** |

**Why smaller model wins:** The 0.6B model loads faster and generates tokens faster. The A10G has plenty of VRAM for both models, so model size is the bottleneck, not GPU memory.

### SDPA vs FA2 Comparison (2026-02-01)

| Metric | SDPA | FA2 | Winner |
|--------|------|-----|--------|
| Cold Start | 68s | 83s | **SDPA** (22% faster) |
| Long Text (2600 chars) | 5.5 min | 6.5 min | **SDPA** (18% faster) |

**Decision:** Standardize on SDPA. FA2 deployment stopped.

See [FA2-BENCHMARK-REPORT.md](./optimization/FA2-BENCHMARK-REPORT.md) for detailed analysis.

---

## Live Endpoints

### Current: 0.6B-Base on A10G (SDPA) ⭐ Voice Cloning

| Endpoint | URL |
|----------|-----|
| Clone | `https://duncab013--qwen3-tts-voice-clone-06b-qwen3ttsservice-clone.modal.run` |
| Health | `https://duncab013--qwen3-tts-voice-clone-06b-qwen3ttsservice-health.modal.run` |
| Languages | `https://duncab013--qwen3-tts-voice-clone-06b-qwen3ttsservice-languages.modal.run` |

### Pending: 1.7B-VoiceDesign (Voice Creation from Text)

Creates new voices from natural language descriptions. **No reference audio needed.**

| Endpoint | URL (after deployment) |
|----------|-----|
| Design | `https://duncab013--qwen3-tts-voice-design-voicedesignservice-design.modal.run` |
| Health | `https://duncab013--qwen3-tts-voice-design-voicedesignservice-health.modal.run` |
| Languages | `https://duncab013--qwen3-tts-voice-design-voicedesignservice-languages.modal.run` |

**Deploy VoiceDesign:**
```bash
cd modal_app/qwen3_tts
uv run modal deploy app_voice_design.py
```

**Example Request:**
```bash
curl -X POST \
  "https://duncab013--qwen3-tts-voice-design-voicedesignservice-design.modal.run" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello! This is a preview of my designed voice.",
    "language": "English",
    "instruct": "A warm, friendly female voice with a gentle tone"
  }' \
  --output designed_voice.wav
```

**Integration Flow:**
```
User describes voice → VoiceDesign generates preview → Save as reference → Use with 0.6B-Base for long-form
```

### Stopped: 1.7B-Base on A10G (SDPA)

Stopped to free Modal endpoints. Can be redeployed with:
```bash
cd modal_app/qwen3_tts
uv run modal deploy app.py
```

See [IMPLEMENTATION-STATUS.md](./IMPLEMENTATION-STATUS.md) for detailed implementation notes and pain points.

---

## Start Here

**New to this guide?** Read [Understanding This Guide](./guides/00-understanding-this-guide.md) first. It explains:
- Why we're using Qwen3-TTS instead of Echo-TTS
- The Flash Attention problem and SDPA solution
- How model caching works with Modal Volumes
- The transcript requirement and why it matters

The understanding guide includes diagrams, intuition-building examples, and a quiz to test your knowledge.

---

## Overview

This guide provides complete instructions for deploying Qwen3-TTS voice cloning models on Modal.com's serverless GPU infrastructure. The deployment exposes a REST API that accepts reference audio and generates cloned speech.

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Modal.com Platform                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐    ┌─────────────────────────────────────────┐    │
│  │  Modal Volume   │    │         GPU Container (T4/A10G)         │    │
│  │  ─────────────  │    │  ┌───────────────────────────────────┐  │    │
│  │  /vol/models/   │◄───┼──│  Qwen3TTSModel (1.7B or 0.6B)     │  │    │
│  │  - model weights│    │  │  - Loaded at container start      │  │    │
│  │  - tokenizer    │    │  │  - Persists across requests       │  │    │
│  │  - config       │    │  └───────────────────────────────────┘  │    │
│  └─────────────────┘    │                    │                    │    │
│                         │                    ▼                    │    │
│                         │  ┌───────────────────────────────────┐  │    │
│                         │  │  FastAPI Endpoint                 │  │    │
│                         │  │  POST /clone - Voice cloning      │  │    │
│                         │  │  GET  /health - Health check      │  │    │
│                         │  └───────────────────────────────────┘  │    │
│                         └─────────────────────────────────────────┘    │
│                                          │                              │
└──────────────────────────────────────────┼──────────────────────────────┘
                                           │
                                           ▼
                              ┌─────────────────────────┐
                              │  Client Application     │
                              │  - POST JSON request    │
                              │  - Receive WAV bytes    │
                              └─────────────────────────┘
```

### Model Specifications

| Property | 0.6B-Base | 1.7B-Base | 1.7B-VoiceDesign |
|----------|-----------|-----------|------------------|
| Parameters | 0.6 billion | 1.7 billion | 1.7 billion |
| VRAM (bf16) | ~2-3 GB | ~5-6 GB | ~5-6 GB |
| Recommended GPU | T4 (16GB) | T4/A10G | A10G |
| Frame Rate | 12 Hz | 12 Hz | 12 Hz |
| Codebooks | 16 × 2048 | 16 × 2048 | 16 × 2048 |
| Quality | Good | Best | Best |
| Use Case | Voice Cloning | Voice Cloning | **Voice Creation** |

**Supported Languages**: Chinese, English, Japanese, Korean, German, French, Russian, Portuguese, Spanish, Italian

---

## Documentation Structure

```
docs/qwen3-tts-modal-deployment/
├── README.md                    # This file - overview and quick start
├── IMPLEMENTATION-STATUS.md     # Current deployment status and changelog
├── NEXT-TASKS.md               # Future tasks and planning
├── RUNNING-AND-TESTING.md      # How to run and test
├── guides/                      # Step-by-step deployment guides
│   ├── 00-understanding-this-guide.md
│   ├── 01-prerequisites.md
│   ├── 02-image-building.md
│   ├── 03-model-caching.md
│   ├── 04-core-service.md
│   ├── 05-api-endpoints.md
│   ├── 06-deployment.md
│   ├── 07-troubleshooting.md
│   └── 08-utter-integration.md
└── optimization/                # Performance optimization docs
    ├── flash-attention-optimization-plan.md
    └── FA2-BENCHMARK-REPORT.md
```

## Implementation Guides

Follow these guides in order for a complete deployment:

| Step | Guide | Description |
|------|-------|-------------|
| 1 | [Prerequisites & Setup](./guides/01-prerequisites.md) | Install Modal CLI, create secrets and volumes |
| 2 | [Image Building](./guides/02-image-building.md) | Build container image with dependencies |
| 3 | [Model Caching](./guides/03-model-caching.md) | Pre-download models to Modal volume |
| 4 | [Core Service](./guides/04-core-service.md) | Implement the Qwen3TTS service class |
| 5 | [API Endpoints](./guides/05-api-endpoints.md) | Build FastAPI REST endpoints |
| 6 | [Deployment](./guides/06-deployment.md) | Deploy and test the service |
| 7 | [Troubleshooting](./guides/07-troubleshooting.md) | Common issues and solutions |
| 8 | [Utter Integration](./guides/08-utter-integration.md) | Connect to utter's voice cloning API |

## Optimization Guides

| Guide | Description |
|-------|-------------|
| [Flash Attention Plan](./optimization/flash-attention-optimization-plan.md) | FA2 deployment strategy and implementation |
| [FA2 Benchmark Report](./optimization/FA2-BENCHMARK-REPORT.md) | Detailed SDPA vs FA2 performance comparison |

---

## Utter Integration Context

This Qwen3-TTS deployment is designed to power **utter**, a voice cloning application. The end-to-end flow is:

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   User      │     │   Utter     │     │  Modal.com       │     │   User      │
│  Uploads    │────▶│  Backend    │────▶│  Qwen3-TTS       │────▶│  Receives   │
│  Reference  │     │  (FastAPI)  │     │  (GPU Inference) │     │  Cloned     │
│  Audio +    │     │             │     │                  │     │  Voice      │
│  Transcript │     │             │     │                  │     │  Audio      │
└─────────────┘     └─────────────┘     └──────────────────┘     └─────────────┘
```

**Key difference from Echo-TTS**: Qwen3-TTS requires a **transcript** of the reference audio for optimal voice cloning. This enables better quality across 10 languages.

See [Step 8: Utter Integration](./guides/08-utter-integration.md) for backend code changes.

---

## Quick Start

If you're familiar with Modal and want to get started quickly:

```bash
# 1. Setup (already done)
modal token new
modal secret create huggingface-secret HF_TOKEN=hf_your_token
modal volume create qwen3-tts-models

# 2. Download models (use uv run if using uv package manager)
cd modal_app/qwen3_tts
uv run modal run download_models.py --model-size 1.7B

# 3. Deploy
uv run modal deploy app.py

# 4. Test with reference audio
curl -X POST https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-clone.modal.run \
  -H "Content-Type: application/json" \
  -d @test_request.json \
  --output output.wav
```

**Note**: Use `uv run modal` instead of `modal` if using uv package manager (as this project does).

---

## Project Structure

```
modal_app/qwen3_tts/
├── __init__.py               # Package initialization
├── app.py                    # 1.7B-Base Modal app (A10G, SDPA)
├── app_fa2.py                # 1.7B-Base Modal app (A10G, Flash Attention 2)
├── app_06b.py                # 0.6B-Base Modal app (A10G, SDPA) ⭐ Active
├── app_voice_design.py       # 1.7B-VoiceDesign Modal app (A10G, SDPA) 🔜 NEW
├── config.py                 # Configuration constants
├── download_models.py        # Model download script
└── test_client.py            # API testing utilities

test/
├── README.md                 # Test suite documentation
├── inputs/
│   ├── reference/            # Voice reference for cloning
│   │   ├── audio.wav         # Reference audio (6.4 MB)
│   │   └── audio_text.txt    # Transcript
│   └── texts/                # Input texts for generation
│       ├── short.txt         # ~55 chars
│       ├── medium.txt        # ~230 chars
│       └── long.txt          # ~2600 chars
├── outputs/
│   ├── SDPA/                 # Generated audio from SDPA
│   └── FA2/                  # Generated audio from FA2
├── results/                  # JSON timing data
└── scripts/
    ├── run_comparison.py     # Main test runner
    ├── compare_fa2_sdpa.py   # Detailed benchmark
    └── test_qwen3_tts.py     # General test script

backend/                       # Utter integration
├── .env                       # TTS_PROVIDER=qwen
├── config.py                  # SUPPORTED_LANGUAGES
├── services/
│   ├── tts.py                 # Provider router
│   └── tts_qwen.py           # Qwen3-TTS Modal client
└── templates/
    ├── clone.html             # Voice cloning UI
    └── generate.html          # Voice generation UI
```

---

## Key Technical Decisions

### Attention Implementation Strategy

**SDPA (Scaled Dot-Product Attention) is the standard** for all deployments.

After benchmarking FA2 vs SDPA, we found SDPA is 18% faster for TTS workloads:
- TTS generates short sequences (~500-2000 tokens) where FA2 optimizations don't apply
- PyTorch 2.10's native SDPA is highly optimized
- SDPA has faster cold starts (68s vs 83s) and simpler deployment

The implementation uses automatic fallback:

```
Priority 1: sdpa (PyTorch native - RECOMMENDED)
Priority 2: flash_attention_2 (if installed, but slower for TTS)
Priority 3: eager (guaranteed compatibility)
```

See [FA2-BENCHMARK-REPORT.md](./optimization/FA2-BENCHMARK-REPORT.md) for detailed benchmarks.

### Model Caching Strategy

Models are pre-downloaded to a Modal Volume to avoid cold-start downloads. The `HF_HOME` environment variable is set to the volume mount path.

### GPU Selection

- **T4 (16GB)**: Sufficient for both 0.6B and 1.7B models
- **A10G (24GB)**: Recommended for 1.7B with batch processing

---

## Task Status

See [NEXT-TASKS.md](./NEXT-TASKS.md) for detailed task history.

| Task | Status | Documentation |
|------|--------|---------------|
| Deploy 0.6B Model | **Complete** | [IMPLEMENTATION-STATUS.md](./IMPLEMENTATION-STATUS.md) |
| Deploy Voice Design Model | Deferred | [NEXT-TASKS.md](./NEXT-TASKS.md#task-2-deploy-voice-design-model) |
| Utter Backend Integration | **Complete** | [IMPLEMENTATION-STATUS.md](./IMPLEMENTATION-STATUS.md) |

---

## Developer Prompting Guide

When starting a new session to work on these tasks, use the following prompts to provide proper context.

### For Voice Design Model Deployment (Future)

```
Research and deploy the Qwen3-TTS Voice Design model for generating voices
from text descriptions.

Context files to read:
- @docs/qwen3-tts-modal-deployment/NEXT-TASKS.md (Task 2 section)
- @docs/qwen-tts-plan.md (original planning with voice design sketch)
- @modal_app/qwen3_tts/app.py (pattern to follow)

Research needed:
1. Verify model exists at HuggingFace (Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign)
2. Understand the generate_voice_design() API
3. Determine if it can share GPU with Base model
```

### General Context Prompt

For any Qwen3-TTS related work, start with:

```
Working on Qwen3-TTS voice cloning for the Utter application.

Key context:
- @docs/qwen3-tts-modal-deployment/README.md (overview)
- @docs/qwen3-tts-modal-deployment/IMPLEMENTATION-STATUS.md (current state)
- @docs/qwen3-tts-modal-deployment/NEXT-TASKS.md (task history)

Live 1.7B endpoints:
- Clone: https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-clone.modal.run
- Health: https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-health.modal.run

Live 0.6B endpoints:
- Clone: https://duncab013--qwen3-tts-voice-clone-06b-qwen3ttsservice-clone.modal.run
- Health: https://duncab013--qwen3-tts-voice-clone-06b-qwen3ttsservice-health.modal.run

Test files:
- @test/reference/audio.wav (reference audio)
- @test/reference/audio_text.txt (transcript)
```

---

## Key Files Quick Reference

| Purpose | File |
|---------|------|
| Implementation status & changelog | [IMPLEMENTATION-STATUS.md](./IMPLEMENTATION-STATUS.md) |
| Next tasks planning | [NEXT-TASKS.md](./NEXT-TASKS.md) |
| FA2 optimization plan | [optimization/flash-attention-optimization-plan.md](./optimization/flash-attention-optimization-plan.md) |
| FA2 benchmark report | [optimization/FA2-BENCHMARK-REPORT.md](./optimization/FA2-BENCHMARK-REPORT.md) |
| Utter integration guide | [guides/08-utter-integration.md](./guides/08-utter-integration.md) |
| Troubleshooting | [guides/07-troubleshooting.md](./guides/07-troubleshooting.md) |
| Modal SDPA app | [modal_app/qwen3_tts/app.py](../../modal_app/qwen3_tts/app.py) |
| Modal FA2 app | [modal_app/qwen3_tts/app_fa2.py](../../modal_app/qwen3_tts/app_fa2.py) |
| Test runner | [test/scripts/run_comparison.py](../../test/scripts/run_comparison.py) |
| Test documentation | [test/README.md](../../test/README.md) |

---

## Reference Links

### Modal.com Documentation
- [Modal Guide](https://modal.com/docs/guide)
- [Modal GPU Guide](https://modal.com/docs/guide/gpu)
- [Modal Volumes Guide](https://modal.com/docs/guide/volumes)
- [Chatterbox TTS Example](https://modal.com/docs/examples/chatterbox_tts)

### Qwen3-TTS Documentation
- [GitHub Repository](https://github.com/QwenLM/Qwen3-TTS)
- [HuggingFace 1.7B-Base](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base)
- [HuggingFace 0.6B-Base](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-Base)

---

## License

This deployment guide is for educational purposes. Qwen3-TTS is licensed under Apache 2.0.
