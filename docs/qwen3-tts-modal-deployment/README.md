# Qwen3-TTS Voice Cloning: Modal.com Deployment Guide

> **Target Models**: `Qwen3-TTS-12Hz-1.7B-Base`, `Qwen3-TTS-12Hz-0.6B-Base`
> **Platform**: Modal.com Serverless GPU Infrastructure
> **Last Updated**: 2026-01-26

---

## Start Here

**New to this guide?** Read [Understanding This Guide](./00-understanding-this-guide.md) first. It explains:
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

| Property | 0.6B-Base | 1.7B-Base |
|----------|-----------|-----------|
| Parameters | 0.6 billion | 1.7 billion |
| VRAM (bf16) | ~2-3 GB | ~5-6 GB |
| Recommended GPU | T4 (16GB) | T4/A10G |
| Frame Rate | 12 Hz | 12 Hz |
| Codebooks | 16 × 2048 | 16 × 2048 |
| Quality | Good | Best |

**Supported Languages**: Chinese, English, Japanese, Korean, German, French, Russian, Portuguese, Spanish, Italian

---

## Implementation Guides

Follow these guides in order for a complete deployment:

| Step | Guide | Description |
|------|-------|-------------|
| 1 | [Prerequisites & Setup](./01-prerequisites.md) | Install Modal CLI, create secrets and volumes |
| 2 | [Image Building](./02-image-building.md) | Build container image with dependencies |
| 3 | [Model Caching](./03-model-caching.md) | Pre-download models to Modal volume |
| 4 | [Core Service](./04-core-service.md) | Implement the Qwen3TTS service class |
| 5 | [API Endpoints](./05-api-endpoints.md) | Build FastAPI REST endpoints |
| 6 | [Deployment](./06-deployment.md) | Deploy and test the service |
| 7 | [Troubleshooting](./07-troubleshooting.md) | Common issues and solutions |
| 8 | [Utter Integration](./08-utter-integration.md) | Connect to utter's voice cloning API |

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

See [Step 8: Utter Integration](./08-utter-integration.md) for backend code changes.

---

## Quick Start

If you're familiar with Modal and want to get started quickly:

```bash
# 1. Setup
modal token new
modal secret create huggingface-secret HF_TOKEN=hf_your_token
modal volume create qwen3-tts-models

# 2. Download models
modal run download_models.py

# 3. Deploy
modal deploy app.py
```

---

## Project Structure

After completing all guides, you'll have:

```
qwen3-tts-modal/
├── app.py                    # Main Modal application
├── config.py                 # Configuration constants
├── download_models.py        # Model download script
└── test_client.py            # Testing utilities
```

---

## Key Technical Decisions

### Attention Implementation Strategy

Flash Attention 2 is a **soft requirement**. The implementation uses automatic fallback:

```
Priority 1: flash_attention_2 (if available)
Priority 2: sdpa (PyTorch native - recommended)
Priority 3: eager (guaranteed compatibility)
```

This avoids C++ compilation issues on Modal's serverless infrastructure.

### Model Caching Strategy

Models are pre-downloaded to a Modal Volume to avoid cold-start downloads. The `HF_HOME` environment variable is set to the volume mount path.

### GPU Selection

- **T4 (16GB)**: Sufficient for both 0.6B and 1.7B models
- **A10G (24GB)**: Recommended for 1.7B with batch processing

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
