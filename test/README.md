# Qwen3-TTS Test Suite

Test scripts and benchmark data for Qwen3-TTS voice cloning on Modal.com.

---

## Quick Navigation

| Section | Description |
|---------|-------------|
| [Benchmark Results](#benchmark-results) | Final performance comparison |
| [Directory Structure](#directory-structure) | File organization |
| [Running Tests](#running-tests) | How to execute benchmarks |
| [Output Files](#output-files) | Generated audio samples |

---

## Benchmark Results

### Complete Model & GPU Comparison (2026-02-02)

All configurations use **SDPA** (Scaled Dot-Product Attention).

| Model | GPU | Cold Start | Short (56 chars) | Medium (800 chars) |
|-------|-----|------------|------------------|-------------------|
| **Qwen3-TTS-12Hz-1.7B-Base** | NVIDIA A10G | 108s | 14.6s | 113s |
| **Qwen3-TTS-12Hz-0.6B-Base** | NVIDIA A10G | **29s** | **11.1s** | **87.6s** |
| **Qwen3-TTS-12Hz-0.6B-Base** | Tesla T4 | 43s | 17.4s | 176s |

### Key Findings

**0.6B on A10G is the fastest configuration:**
- **Cold start: 29s** — 3.7x faster than 1.7B, 1.5x faster than 0.6B on T4
- **Short text: 11.1s** — 24% faster than 1.7B, 36% faster than 0.6B on T4
- **Medium text: 87.6s** — 22% faster than 1.7B, 50% faster than 0.6B on T4

**Why 0.6B beats 1.7B on the same GPU:**
- Smaller model = faster loading (cold start)
- Smaller model = faster inference per token
- A10G has plenty of VRAM for both models — no bottleneck there

### Recommendation

| Use Case | Recommended Config | Why |
|----------|-------------------|-----|
| **Best performance** | 0.6B on A10G | Fastest generation, fast cold start |
| **Best quality** | 1.7B on A10G | Larger model may have better voice quality |
| **Cost-optimized** | 0.6B on T4 | T4 costs ~$0.59/hr vs A10G ~$1.10/hr |

### Attention Implementation: SDPA vs FA2 (2026-02-01)

Tested on 1.7B model only.

| Metric | SDPA | FA2 | Winner |
|--------|------|-----|--------|
| Cold Start | 68s | 83s | **SDPA** (22% faster) |
| Long Text (2600 chars) | 5.5 min | 6.5 min | **SDPA** (18% faster) |

**Decision:** Standardize on SDPA for all deployments. FA2 deployment stopped.

See [FA2-BENCHMARK-REPORT.md](../docs/qwen3-tts-modal-deployment/optimization/FA2-BENCHMARK-REPORT.md) for details.

---

## Directory Structure

```
test/
├── README.md                      # This file
│
├── inputs/
│   ├── reference/                 # Voice reference for cloning
│   │   ├── audio.wav              # Reference audio (~40s speech sample)
│   │   └── audio_text.txt         # Transcript of reference audio
│   │
│   └── texts/                     # Input texts for generation tests
│       ├── short.txt              # 56 characters
│       ├── medium.txt             # 800 characters (tokenization tutorial excerpt)
│       └── long.txt               # 2616 characters (full tokenization tutorial)
│
├── outputs/                       # Generated audio samples
│   │
│   ├── 0.6B-A10G-SDPA/           # Qwen3-TTS-12Hz-0.6B-Base on NVIDIA A10G ⭐ FASTEST
│   │   ├── warmup.wav
│   │   ├── short.wav
│   │   └── medium.wav
│   │
│   ├── 1.7B-A10G-SDPA/           # Qwen3-TTS-12Hz-1.7B-Base on NVIDIA A10G
│   │   ├── warmup.wav
│   │   ├── short.wav
│   │   └── medium.wav
│   │
│   ├── 0.6B-T4-SDPA/             # Qwen3-TTS-12Hz-0.6B-Base on Tesla T4 (cost-optimized)
│   │   ├── warmup.wav
│   │   ├── short.wav
│   │   └── medium.wav
│   │
│   ├── SDPA/                      # 1.7B SDPA vs FA2 comparison (legacy)
│   │   └── *.wav
│   │
│   └── FA2/                       # 1.7B FA2 outputs (legacy, deployment stopped)
│       └── *.wav
│
├── results/                       # JSON benchmark data
│   ├── model_comparison_*.json    # 1.7B vs 0.6B comparison results
│   ├── comparison_*.json          # SDPA vs FA2 comparison results
│   └── generation_benchmark_*.json
│
└── scripts/
    ├── compare_models.py          # 1.7B vs 0.6B comparison (recommended)
    ├── compare_fa2_sdpa.py        # SDPA vs FA2 benchmark
    ├── compare_generation_only.py # Generation-focused benchmark
    ├── run_comparison.py          # General test runner
    └── test_qwen3_tts.py          # Single-model test script
```

---

## Running Tests

### Compare 1.7B vs 0.6B Models

```bash
cd test/scripts
python compare_models.py
```

Tests both models on short and medium texts, saves outputs and timing data.

### Test Single Model

```bash
# Test 1.7B (default)
python test_qwen3_tts.py

# Test 0.6B
python test_qwen3_tts.py --model 0.6B

# Test with custom text
python test_qwen3_tts.py --model 1.7B --text "Your custom text here"
```

### Run SDPA vs FA2 Comparison (Legacy)

```bash
python compare_fa2_sdpa.py
```

Note: FA2 deployment has been stopped. This script is kept for reference.

---

## Input Texts

| File | Characters | Description |
|------|------------|-------------|
| `short.txt` | 56 | Simple voice cloning test sentence |
| `medium.txt` | 800 | Tokenization tutorial excerpt |
| `long.txt` | 2616 | Full tokenization tutorial (very long generation) |

---

## Output Files

### Naming Convention

Output folders follow the pattern: `{MODEL}-{GPU}-{ATTENTION}`

| Folder | Model | GPU | Attention | Status |
|--------|-------|-----|-----------|--------|
| `0.6B-A10G-SDPA/` | Qwen3-TTS-12Hz-0.6B-Base | NVIDIA A10G | SDPA | ⭐ **Fastest** |
| `1.7B-A10G-SDPA/` | Qwen3-TTS-12Hz-1.7B-Base | NVIDIA A10G | SDPA | Best quality |
| `0.6B-T4-SDPA/` | Qwen3-TTS-12Hz-0.6B-Base | Tesla T4 | SDPA | Cost-optimized |
| `SDPA/` | 1.7B (legacy naming) | A10G | SDPA | Legacy |
| `FA2/` | 1.7B (legacy naming) | A10G | Flash Attention 2 | Stopped |

### Audio Files

- `warmup.wav` — Generated during cold start (container initialization)
- `short.wav` — Generated from `inputs/texts/short.txt`
- `medium.wav` — Generated from `inputs/texts/medium.txt`
- `long.wav` — Generated from `inputs/texts/long.txt`

---

## Live Endpoints

### Production (1.7B on A10G)

```
Clone:  https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-clone.modal.run
Health: https://duncab013--qwen3-tts-voice-clone-qwen3ttsservice-health.modal.run
```

### Lighter Workloads (0.6B on T4)

```
Clone:  https://duncab013--qwen3-tts-voice-clone-06b-qwen3ttsservice-clone.modal.run
Health: https://duncab013--qwen3-tts-voice-clone-06b-qwen3ttsservice-health.modal.run
```

---

## Results JSON Format

### Model Comparison Results

```json
{
  "timestamp": "2026-02-02T00:40:32",
  "num_runs": 3,
  "models": {
    "1.7B": {
      "name": "1.7B (A10G, SDPA)",
      "health": {
        "model": "Qwen3-TTS-12Hz-1.7B-Base",
        "gpu": "NVIDIA A10G",
        "attention_implementation": "sdpa"
      },
      "cold_start": { "time": 107.95, "audio_size": 107458 },
      "tests": {
        "short": {
          "text_length": 56,
          "runs": [
            { "time": 12.96, "audio_size": 188022 },
            { "time": 17.59, "audio_size": 207204 },
            { "time": 13.13, "audio_size": 199530 }
          ]
        }
      }
    },
    "0.6B": {
      "name": "0.6B (T4, SDPA)",
      "health": {
        "model": "Qwen3-TTS-12Hz-0.6B-Base",
        "gpu": "Tesla T4",
        "attention_implementation": "sdpa"
      },
      "cold_start": { "time": 43.02, "audio_size": 122802 },
      "tests": { "...": "..." }
    }
  },
  "summary": [
    { "text": "short", "chars": 56, "1.7B_time": 14.56, "0.6B_time": 17.42 },
    { "text": "medium", "chars": 800, "1.7B_time": 113.17, "0.6B_time": 176.16 }
  ]
}
```
